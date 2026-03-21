import type { PrismaClient } from "../../../app/generated/prisma/client";
import {
  SubtitleSourceType,
  TranscriptionEngine,
  TranscriptionJobStatus,
} from "../../../app/generated/prisma/client";

import { MediaStorageService } from "./media-storage.service";
import { MockTranscriptionAdapter } from "./mock-transcription.adapter";
import { OpenAIWhisperAdapter } from "./openai-whisper.adapter";
import type { TranscriptionAdapter } from "./transcription-adapter";
import { CueRepository } from "./cue-repository";
import { getMaxTranscriptionAttempts } from "./env";
import { normalizeTranscript } from "./transcript-normalizer";

function logJob(event: string, payload: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ts: new Date().toISOString(), scope: "transcription-job", event, ...payload }));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Erros em que nova tentativa não costuma resolver (evita backoff inútil). */
function isNonRetryableTranscriptionError(message: string): boolean {
  const m = message.toLowerCase();
  if (m.includes("demasiado grande")) return true;
  if (m.includes("máx. 25 mb")) return true;
  if (m.includes("413")) return true;
  if (m.includes("payload too large")) return true;
  if (m.includes("maximum content size limit")) return true;
  if (m.includes("401")) return true;
  if (m.includes("403")) return true;
  if (m.includes("invalid_api_key")) return true;
  if (m.includes("incorrect api key")) return true;
  if (m.includes("quota")) return true;
  if (m.includes("enoent")) return true;
  if (m.includes("ffmpeg não encontrado")) return true;
  return false;
}

function adapterForEngine(engine: TranscriptionEngine): TranscriptionAdapter {
  switch (engine) {
    case TranscriptionEngine.MOCK:
      return new MockTranscriptionAdapter();
    case TranscriptionEngine.OPENAI_WHISPER:
    default:
      return new OpenAIWhisperAdapter();
  }
}

export class TranscriptionJobService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly media: MediaStorageService,
  ) {}

  async createAndEnqueue(params: {
    projectId: string;
    subtitleFileId: string;
    engine?: TranscriptionEngine;
    language?: string | null;
    prompt?: string | null;
    /** Se false, só cria o job PENDING (ex.: gerador em lote antes do start). */
    enqueue?: boolean;
    batchId?: string | null;
    originalFilename?: string | null;
    exportFormat?: string | null;
  }) {
    const engine = params.engine ?? TranscriptionEngine.OPENAI_WHISPER;

    const job = await this.prisma.transcriptionJob.create({
      data: {
        projectId: params.projectId,
        subtitleFileId: params.subtitleFileId,
        status: TranscriptionJobStatus.PENDING,
        engine,
        language: params.language ?? undefined,
        batchId: params.batchId ?? undefined,
        originalFilename: params.originalFilename ?? undefined,
        exportFormat: params.exportFormat ?? undefined,
      },
      select: { id: true, status: true },
    });

    if (params.enqueue !== false) {
      void this.runInBackground(job.id, {
        language: params.language ?? undefined,
        prompt: params.prompt ?? undefined,
      }).catch((err) => {
        logJob("background_run_unhandled", { jobId: job.id, error: String(err) });
      });
    }

    return job;
  }

  /**
   * Executa um job até estado terminal (DONE ou FAILED). Usado pelo gerador em lote (sequencial).
   */
  async runJobToCompletion(
    jobId: string,
    opts?: { language?: string; prompt?: string; openaiApiKey?: string },
  ): Promise<void> {
    return this.runInBackground(jobId, opts ?? {});
  }

  private async runInBackground(
    jobId: string,
    opts: { language?: string; prompt?: string; openaiApiKey?: string },
  ): Promise<void> {
    const max = getMaxTranscriptionAttempts();
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= max; attempt++) {
      const job = await this.prisma.transcriptionJob.findUnique({
        where: { id: jobId },
        include: {
          project: { select: { id: true, storageKey: true } },
          subtitleFile: { select: { id: true, projectId: true } },
        },
      });

      if (!job) {
        logJob("job_missing", { jobId });
        return;
      }

      if (!job.project.storageKey) {
        await this.prisma.transcriptionJob.update({
          where: { id: jobId },
          data: {
            status: TranscriptionJobStatus.FAILED,
            errorMessage: "Projeto sem storageKey de midia",
            attemptCount: attempt,
            completedAt: new Date(),
          },
        });
        return;
      }

      const audioAbsolutePath = this.media.resolveAbsolutePath(job.project.storageKey);
      const adapter = adapterForEngine(job.engine);

      logJob("status_transition", { jobId, from: job.status, to: "RUNNING", attempt });

      await this.prisma.transcriptionJob.update({
        where: { id: jobId },
        data: {
          status: TranscriptionJobStatus.RUNNING,
          startedAt: job.startedAt ?? new Date(),
          attemptCount: attempt,
          errorMessage: null,
        },
      });

      try {
        const { transcript, rawResponse } = await adapter.transcribe({
          audioUrl: audioAbsolutePath,
          language: opts.language ?? job.language ?? undefined,
          prompt: opts.prompt,
          openaiApiKey: opts.openaiApiKey,
        });

        const cues = normalizeTranscript(transcript);

        await this.prisma.$transaction(async (tx) => {
          await tx.transcriptionJob.update({
            where: { id: jobId },
            data: {
              rawResponse: rawResponse as object,
              language: transcript.language,
            },
          });

          await new CueRepository(tx).saveBatchForTranscription({
            subtitleFileId: job.subtitleFileId,
            jobId,
            cues,
          });

          await tx.subtitleFile.update({
            where: { id: job.subtitleFileId },
            data: {
              language: transcript.language,
              sourceType: SubtitleSourceType.IMPORTED_WHISPER,
            },
          });

          await tx.transcriptionJob.update({
            where: { id: jobId },
            data: {
              status: TranscriptionJobStatus.DONE,
              completedAt: new Date(),
              errorMessage: null,
            },
          });
        });

        logJob("status_transition", { jobId, to: "DONE", attempt });
        return;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
        logJob("attempt_failed", { jobId, attempt, error: lastError });

        await this.prisma.transcriptionJob.update({
          where: { id: jobId },
          data: {
            errorMessage: lastError,
            attemptCount: attempt,
          },
        });

        if (isNonRetryableTranscriptionError(lastError)) {
          await this.prisma.transcriptionJob.update({
            where: { id: jobId },
            data: {
              status: TranscriptionJobStatus.FAILED,
              completedAt: new Date(),
            },
          });
          logJob("status_transition", {
            jobId,
            to: "FAILED",
            attempt,
            reason: "non_retryable",
          });
          return;
        }

        if (attempt >= max) {
          await this.prisma.transcriptionJob.update({
            where: { id: jobId },
            data: {
              status: TranscriptionJobStatus.FAILED,
              completedAt: new Date(),
            },
          });
          logJob("status_transition", { jobId, to: "FAILED", attempt });
          return;
        }

        const backoffMs = Math.min(8000, 1000 * 2 ** (attempt - 1));
        await sleep(backoffMs);
      }
    }
  }

  async retry(jobId: string, opts?: { language?: string; prompt?: string; openaiApiKey?: string }) {
    const job = await this.prisma.transcriptionJob.findUnique({
      where: { id: jobId },
      select: { id: true, status: true },
    });

    if (!job) {
      return { ok: false as const, error: "Job nao encontrado" };
    }

    if (job.status !== TranscriptionJobStatus.FAILED) {
      return { ok: false as const, error: "Retry permitido apenas para jobs FAILED" };
    }

    await this.prisma.transcriptionJob.update({
      where: { id: jobId },
      data: {
        status: TranscriptionJobStatus.PENDING,
        errorMessage: null,
        completedAt: null,
        startedAt: null,
        attemptCount: 0,
      },
    });

    void this.runInBackground(jobId, {
      language: opts?.language,
      prompt: opts?.prompt,
      openaiApiKey: opts?.openaiApiKey,
    }).catch((err) => {
      logJob("retry_background_unhandled", { jobId, error: String(err) });
    });

    return { ok: true as const, jobId };
  }
}
