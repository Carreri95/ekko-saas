import type { PrismaClient } from "../../generated/prisma/client.js";
import { TranscriptionEngine, TranscriptionJobStatus } from "../../generated/prisma/client.js";

/**
 * Orquestração HTTP apenas: cria jobs e altera estado na BD.
 * A execução pesada corre em `apps/worker` (PR 6.1).
 */
export class TranscriptionJobService {
  constructor(private readonly prisma: PrismaClient) {}

  async createAndEnqueue(params: {
    projectId: string;
    subtitleFileId: string;
    engine?: TranscriptionEngine;
    language?: string | null;
    prompt?: string | null;
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

    return job;
  }

  async retry(jobId: string, opts?: { language?: string; prompt?: string; openaiApiKey?: string }) {
    void opts;
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

    return { ok: true as const, jobId };
  }
}
