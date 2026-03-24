import type { PrismaClient } from "../../../api/src/generated/prisma/client.js";
import {
  BatchJobStatus,
  SubtitleSourceType,
  TranscriptionEngine,
  TranscriptionJobStatus,
} from "../../../api/src/generated/prisma/client.js";

import { MediaStorageService } from "./media-storage.service.js";
import { MockTranscriptionAdapter } from "./mock-transcription.adapter.js";
import { OpenAIWhisperAdapter } from "./openai-whisper.adapter.js";
import type { TranscriptionAdapter } from "./transcription-adapter.js";
import { CueRepository } from "./cue-repository.js";
import { getMaxTranscriptionAttempts } from "./env.js";
import { normalizeTranscript } from "./transcript-normalizer.js";

function logJob(event: string, payload: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      scope: "transcription-worker",
      event,
      ...payload,
    }),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

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

/**
 * Claim atómico PENDING → RUNNING (evita duplo processamento com vários workers).
 * Retorna false se outro processo já reclamou ou o job não está PENDING.
 */
async function claimPendingJob(
  prisma: PrismaClient,
  jobId: string,
  attempt: number,
): Promise<boolean> {
  const now = new Date();
  const res = await prisma.transcriptionJob.updateMany({
    where: { id: jobId, status: TranscriptionJobStatus.PENDING },
    data: {
      status: TranscriptionJobStatus.RUNNING,
      startedAt: now,
      attemptCount: attempt,
      errorMessage: null,
    },
  });
  return res.count === 1;
}

/**
 * Continua tentativas internas com job já RUNNING (mesmo processo).
 */
async function refreshRunningAttempt(
  prisma: PrismaClient,
  jobId: string,
  attempt: number,
): Promise<boolean> {
  const res = await prisma.transcriptionJob.updateMany({
    where: { id: jobId, status: TranscriptionJobStatus.RUNNING },
    data: {
      attemptCount: attempt,
      errorMessage: null,
    },
  });
  return res.count === 1;
}

/**
 * Executa o pipeline completo de um job (equivalente ao antigo `runInBackground` no Next).
 */
export async function runTranscriptionJob(
  prisma: PrismaClient,
  media: MediaStorageService,
  jobId: string,
  opts: { language?: string; prompt?: string; openaiApiKey?: string } = {},
): Promise<void> {
  const max = getMaxTranscriptionAttempts();
  let lastError: string | null = null;

  for (let attempt = 1; attempt <= max; attempt++) {
    const job = await prisma.transcriptionJob.findUnique({
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

    if (attempt === 1) {
      if (job.status === TranscriptionJobStatus.DONE || job.status === TranscriptionJobStatus.FAILED) {
        logJob("skip_terminal", { jobId, status: job.status });
        return;
      }
      if (job.status === TranscriptionJobStatus.RUNNING) {
        logJob("skip_already_running", { jobId });
        return;
      }
      const claimed = await claimPendingJob(prisma, jobId, attempt);
      if (!claimed) {
        logJob("claim_lost_or_not_pending", { jobId });
        return;
      }
    } else {
      if (job.status !== TranscriptionJobStatus.RUNNING) {
        logJob("abort_retry_wrong_status", { jobId, status: job.status, attempt });
        return;
      }
      const ok = await refreshRunningAttempt(prisma, jobId, attempt);
      if (!ok) {
        logJob("refresh_running_failed", { jobId, attempt });
        return;
      }
    }

    if (!job.project.storageKey) {
      await prisma.transcriptionJob.update({
        where: { id: jobId },
        data: {
          status: TranscriptionJobStatus.FAILED,
          errorMessage: "Projeto sem storageKey de midia",
          attemptCount: attempt,
          completedAt: new Date(),
        },
      });
      await maybeFinalizeBatch(prisma, job.batchId);
      return;
    }

    const audioAbsolutePath = media.resolveAbsolutePath(job.project.storageKey);
    const adapter = adapterForEngine(job.engine);

    logJob("pipeline_start", { jobId, attempt, engine: job.engine });

    try {
      const { transcript, rawResponse } = await adapter.transcribe({
        audioUrl: audioAbsolutePath,
        language: opts.language ?? job.language ?? undefined,
        prompt: opts.prompt,
        openaiApiKey: opts.openaiApiKey,
      });

      const cues = normalizeTranscript(transcript);

      await prisma.$transaction(async (tx) => {
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
      await maybeFinalizeBatch(prisma, job.batchId);
      return;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      logJob("attempt_failed", { jobId, attempt, error: lastError });

      await prisma.transcriptionJob.update({
        where: { id: jobId },
        data: {
          errorMessage: lastError,
          attemptCount: attempt,
        },
      });

      if (isNonRetryableTranscriptionError(lastError)) {
        await prisma.transcriptionJob.update({
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
        await maybeFinalizeBatch(prisma, job.batchId);
        return;
      }

      if (attempt >= max) {
        await prisma.transcriptionJob.update({
          where: { id: jobId },
          data: {
            status: TranscriptionJobStatus.FAILED,
            completedAt: new Date(),
          },
        });
        logJob("status_transition", { jobId, to: "FAILED", attempt });
        await maybeFinalizeBatch(prisma, job.batchId);
        return;
      }

      const backoffMs = Math.min(8000, 1000 * 2 ** (attempt - 1));
      await sleep(backoffMs);
    }
  }
}

async function maybeFinalizeBatch(
  prisma: PrismaClient,
  batchId: string | null,
): Promise<void> {
  if (!batchId) return;

  const jobs = await prisma.transcriptionJob.findMany({
    where: { batchId },
    select: { status: true },
  });
  if (jobs.length === 0) return;

  const allTerminal = jobs.every(
    (j) =>
      j.status === TranscriptionJobStatus.DONE || j.status === TranscriptionJobStatus.FAILED,
  );
  if (!allTerminal) return;

  await prisma.batchJob.update({
    where: { id: batchId },
    data: {
      status: BatchJobStatus.DONE,
      completedAt: new Date(),
    },
  });
}
