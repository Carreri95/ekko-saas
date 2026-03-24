import type { FastifyInstance } from "fastify";

import {
  Prisma,
  SubtitleSourceType,
  TranscriptionEngine,
  TranscriptionJobStatus,
} from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/db/prisma.client.js";
import { findLatestSubtitleFileForProject } from "../projects/subtitle-file-queries.js";
import { CueRepository } from "./cue-repository.js";
import { parseStoredRawResponseToTranscript } from "./raw-response-to-transcript.js";
import { TranscriptionJobService } from "./transcription-job.service.js";
import { normalizeTranscript } from "./transcript-normalizer.js";

type TranscriptionsBody = {
  engine?: string;
  language?: string;
  prompt?: string;
};

type RetryBody = {
  language?: string;
  prompt?: string;
};

export async function registerTranscriptionJobRoutes(app: FastifyInstance): Promise<void> {
  const svc = new TranscriptionJobService(prisma);

  app.get<{ Params: { jobId: string } }>("/api/jobs/:jobId/status", async (request, reply) => {
    const jobId = request.params.jobId;
    if (!jobId?.trim()) {
      return reply.status(400).send({ error: "jobId obrigatorio" });
    }

    const job = await prisma.transcriptionJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        status: true,
        errorMessage: true,
        attemptCount: true,
        projectId: true,
        subtitleFileId: true,
        engine: true,
        language: true,
        startedAt: true,
        completedAt: true,
      },
    });

    if (!job) {
      return reply.status(404).send({ error: "Job nao encontrado" });
    }

    return reply.send({
      jobId: job.id,
      status: job.status,
      progress: null,
      errorMessage: job.errorMessage,
      attemptCount: job.attemptCount,
      projectId: job.projectId,
      subtitleFileId: job.subtitleFileId,
      engine: job.engine,
      language: job.language,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    });
  });

  app.post<{ Params: { id: string }; Body: TranscriptionsBody }>(
    "/api/projects/:id/transcriptions",
    async (request, reply) => {
      const projectId = request.params.id;
      if (!projectId?.trim()) {
        return reply.status(400).send({ error: "projectId obrigatorio" });
      }

      const raw = request.body;
      const body: TranscriptionsBody =
        raw !== undefined && raw !== null && typeof raw === "object" && !Array.isArray(raw)
          ? (raw as TranscriptionsBody)
          : {};

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true, storageKey: true },
      });

      if (!project) {
        return reply.status(404).send({ error: "Projeto nao encontrado" });
      }

      if (!project.storageKey) {
        return reply.status(400).send({
          error: "Nenhuma midia no projeto. Faca POST /api/projects/:id/media primeiro.",
        });
      }

      const subtitleFile = await findLatestSubtitleFileForProject(prisma, projectId);
      if (!subtitleFile) {
        return reply.status(400).send({
          error: "SubtitleFile nao encontrado para o projeto. Faca upload de midia primeiro.",
        });
      }

      const engine =
        body.engine?.toUpperCase() === "MOCK"
          ? TranscriptionEngine.MOCK
          : TranscriptionEngine.OPENAI_WHISPER;

      const job = await svc.createAndEnqueue({
        projectId,
        subtitleFileId: subtitleFile.id,
        engine,
        language: body.language ?? null,
        prompt: body.prompt ?? null,
      });

      return reply.send({
        jobId: job.id,
        status: job.status,
      });
    },
  );

  app.post<{ Params: { jobId: string }; Body: RetryBody }>(
    "/api/jobs/:jobId/retry",
    async (request, reply) => {
      const jobId = request.params.jobId;
      if (!jobId?.trim()) {
        return reply.status(400).send({ error: "jobId obrigatorio" });
      }

      const raw = request.body;
      const body: RetryBody =
        raw !== undefined && raw !== null && typeof raw === "object" && !Array.isArray(raw)
          ? (raw as RetryBody)
          : {};

      const result = await svc.retry(jobId, {
        language: body.language,
        prompt: body.prompt,
      });

      if (!result.ok) {
        const status = result.error.includes("nao encontrado") ? 404 : 400;
        return reply.status(status).send({ error: result.error });
      }

      return reply.send({ jobId: result.jobId, status: "PENDING" });
    },
  );

  app.post<{ Params: { jobId: string } }>("/api/jobs/:jobId/reprocess-normalization", async (request, reply) => {
    const jobId = request.params.jobId;
    if (!jobId?.trim()) {
      return reply.status(400).send({ error: "jobId obrigatorio" });
    }

    const job = await prisma.transcriptionJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        status: true,
        rawResponse: true,
        subtitleFileId: true,
        projectId: true,
      },
    });

    if (!job) {
      return reply.status(404).send({ error: "Job nao encontrado" });
    }

    if (job.status === TranscriptionJobStatus.PENDING || job.status === TranscriptionJobStatus.RUNNING) {
      return reply.status(409).send({
        error: "Job ainda em execucao; aguarde DONE ou FAILED com rawResponse",
      });
    }

    if (job.rawResponse === null || job.rawResponse === undefined) {
      return reply.status(400).send({
        error:
          "Este job nao tem rawResponse guardado. So e possivel re-normalizar apos uma transcrição que tenha persistido a resposta bruta.",
      });
    }

    let transcript;
    try {
      transcript = parseStoredRawResponseToTranscript(job.rawResponse);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.status(400).send({ error: `Falha ao ler rawResponse: ${msg}` });
    }

    const cues = normalizeTranscript(transcript);

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await new CueRepository(tx).saveBatchForTranscription({
        subtitleFileId: job.subtitleFileId,
        jobId: job.id,
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
        where: { id: job.id },
        data: {
          language: transcript.language,
        },
      });
    });

    return reply.send({
      jobId: job.id,
      projectId: job.projectId,
      subtitleFileId: job.subtitleFileId,
      cueCount: cues.length,
      language: transcript.language,
    });
  });
}
