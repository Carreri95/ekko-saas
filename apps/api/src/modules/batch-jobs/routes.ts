import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { TranscriptionEngine } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/db/prisma.client.js";
import { isDatabaseConnectionError } from "../../infrastructure/prisma-errors.js";
import { AuthService } from "../auth/service.js";
import { getMediaStorageService } from "../projects/media-storage.service.js";
import { TranscriptionJobService } from "../transcription-jobs/transcription-job.service.js";
import { BatchJobService } from "./batch-job.service.js";

const OPENAI_HEADER = "x-openai-key";

const DB_UNAVAILABLE_ERROR =
  "Base de dados indisponivel. Arranque o PostgreSQL e confirme DATABASE_URL.";

export async function registerBatchJobRoutes(app: FastifyInstance): Promise<void> {
  const media = getMediaStorageService();
  const transcriptionJobs = new TranscriptionJobService(prisma);
  const svc = new BatchJobService(prisma, media, transcriptionJobs);
  const authService = new AuthService();

  async function ensureUser(request: FastifyRequest, reply: FastifyReply) {
    const session = await authService.resolveSessionUser(request);
    if (!session.ok) {
      if (session.error === "inactive") {
        void reply.status(403).send({ error: "Conta desativada" });
        return null;
      }
      void reply.status(401).send({ error: "Nao autenticado" });
      return null;
    }
    return session.user;
  }

  async function ensureBatchOwner(batchId: string, userId: string): Promise<boolean> {
    const batch = await prisma.batchJob.findUnique({
      where: { id: batchId },
      select: { userId: true },
    });
    return Boolean(batch && batch.userId === userId);
  }

  app.post("/api/batch-jobs", async (request, reply) => {
    const user = await ensureUser(request, reply);
    if (!user) return;
    try {
      const batch = await svc.createBatch(user.id);
      return reply.status(201).send({ batchId: batch.id });
    } catch (e) {
      if (isDatabaseConnectionError(e)) {
        return reply.status(503).send({ error: DB_UNAVAILABLE_ERROR });
      }
      app.log.error({ err: e }, "[POST /api/batch-jobs]");
      const message = e instanceof Error ? e.message : "Erro ao criar batch.";
      return reply.status(500).send({ error: message });
    }
  });

  app.post<{ Params: { batchId: string } }>(
    "/api/batch-jobs/:batchId/files",
    async (request, reply) => {
      const user = await ensureUser(request, reply);
      if (!user) return;
      const batchId = request.params.batchId;
      if (!batchId) {
        return reply.status(400).send({ error: "batchId obrigatorio" });
      }
      if (!(await ensureBatchOwner(batchId, user.id))) {
        return reply.status(404).send({ error: "Batch nao encontrado" });
      }

      if (!request.isMultipart()) {
        return reply.status(400).send({ error: "multipart invalido" });
      }

      let fileBuffer: Buffer | null = null;
      let mimeType = "application/octet-stream";
      let originalFilename = "audio.bin";
      const fields: Record<string, string> = {};

      try {
        for await (const part of request.parts()) {
          if ("file" in part && part.file) {
            if (part.fieldname === "file") {
              fileBuffer = await part.toBuffer();
              mimeType = part.mimetype || mimeType;
              originalFilename = part.filename || originalFilename;
            }
          } else {
            const field = part as { fieldname: string; value?: unknown };
            fields[field.fieldname] =
              typeof field.value === "string" ? field.value : String(field.value ?? "");
          }
        }
      } catch {
        return reply.status(400).send({ error: "multipart invalido" });
      }

      if (!fileBuffer) {
        return reply.status(400).send({ error: "Campo file e obrigatorio" });
      }

      const engineRaw = String(fields.engine ?? "OPENAI_WHISPER").toUpperCase();
      const engine =
        engineRaw === "MOCK" ? TranscriptionEngine.MOCK : TranscriptionEngine.OPENAI_WHISPER;

      const languageRaw = fields.language;
      const language =
        typeof languageRaw === "string" && languageRaw.trim() !== ""
          ? languageRaw.trim()
          : null;

      const exportFormat = String(fields.exportFormat ?? "SRT").toUpperCase();

      try {
        const result = await svc.addFileFromUpload({
          batchId,
          buffer: fileBuffer,
          mimeType,
          originalFilename,
          engine,
          language,
          exportFormat,
        });
        return reply.status(201).send(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("nao encontrado")) {
          return reply.status(404).send({ error: msg });
        }
        if (msg.includes("nao aceita")) {
          return reply.status(400).send({ error: msg });
        }
        return reply.status(400).send({ error: msg });
      }
    },
  );

  app.get<{ Params: { batchId: string } }>(
    "/api/batch-jobs/:batchId/download",
    async (request, reply) => {
      const user = await ensureUser(request, reply);
      if (!user) return;
      const batchId = request.params.batchId;
      if (!batchId) {
        return reply.status(400).send({ error: "batchId obrigatorio" });
      }
      if (!(await ensureBatchOwner(batchId, user.id))) {
        return reply.status(404).send({ error: "Batch nao encontrado" });
      }

      try {
        const buf = await svc.buildZipForDoneJobs(batchId);
        const safe = `legendas-${batchId.slice(0, 8)}.zip`;
        return reply
          .status(200)
          .header("Content-Type", "application/zip")
          .header("Content-Disposition", `attachment; filename="${safe}"`)
          .header("Cache-Control", "no-store")
          .send(buf);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("nao encontrado")) {
          return reply.status(404).send({ error: msg });
        }
        return reply.status(400).send({ error: msg });
      }
    },
  );

  app.get<{ Params: { batchId: string } }>("/api/batch-jobs/:batchId", async (request, reply) => {
    const user = await ensureUser(request, reply);
    if (!user) return;
    const batchId = request.params.batchId;
    if (!batchId) {
      return reply.status(400).send({ error: "batchId obrigatorio" });
    }
    if (!(await ensureBatchOwner(batchId, user.id))) {
      return reply.status(404).send({ error: "Batch nao encontrado" });
    }

    const status = await svc.getBatchStatus(batchId);
    if (!status) {
      return reply.status(404).send({ error: "Batch nao encontrado" });
    }

    return reply.send(status);
  });

  app.post<{ Params: { batchId: string } }>(
    "/api/batch-jobs/:batchId/start",
    async (request, reply) => {
      const user = await ensureUser(request, reply);
      if (!user) return;
      const batchId = request.params.batchId;
      if (!batchId) {
        return reply.status(400).send({ error: "batchId obrigatorio" });
      }
      if (!(await ensureBatchOwner(batchId, user.id))) {
        return reply.status(404).send({ error: "Batch nao encontrado" });
      }

      const rawKey = request.headers[OPENAI_HEADER];
      const openaiApiKey =
        typeof rawKey === "string"
          ? rawKey.trim() || undefined
          : rawKey?.[0]?.trim() || undefined;

      void svc.processBatchSequential(batchId, openaiApiKey).catch((err: unknown) => {
        app.log.error({ err, batchId }, "[batch-jobs/start]");
      });

      return reply.send({ ok: true, started: true });
    },
  );

  app.post<{ Params: { batchId: string; jobId: string } }>(
    "/api/batch-jobs/:batchId/jobs/:jobId/retry",
    async (request, reply) => {
      const user = await ensureUser(request, reply);
      if (!user) return;
      const batchId = request.params.batchId;
      const jobId = request.params.jobId;
      if (!batchId || !jobId) {
        return reply.status(400).send({ error: "batchId e jobId obrigatorios" });
      }
      if (!(await ensureBatchOwner(batchId, user.id))) {
        return reply.status(404).send({ error: "Batch nao encontrado" });
      }

      const job = await prisma.transcriptionJob.findUnique({
        where: { id: jobId },
        select: { id: true, batchId: true },
      });

      if (!job || job.batchId !== batchId) {
        return reply.status(404).send({ error: "Job nao encontrado neste batch" });
      }

      const rawKey = request.headers[OPENAI_HEADER];
      const openaiApiKey =
        typeof rawKey === "string"
          ? rawKey.trim() || undefined
          : rawKey?.[0]?.trim() || undefined;

      const result = await transcriptionJobs.retry(jobId, {
        openaiApiKey,
      });

      if (!result.ok) {
        return reply.status(400).send({ error: result.error });
      }

      return reply.send({ ok: true, jobId });
    },
  );

  app.delete<{ Params: { batchId: string }; Body: unknown }>(
    "/api/batch-jobs/:batchId/jobs",
    async (request, reply) => {
      const user = await ensureUser(request, reply);
      if (!user) return;
      const batchId = request.params.batchId;
      if (!batchId) {
        return reply.status(400).send({ error: "batchId obrigatorio" });
      }
      if (!(await ensureBatchOwner(batchId, user.id))) {
        return reply.status(404).send({ error: "Batch nao encontrado" });
      }

      let body: { jobIds?: unknown };
      try {
        const raw = request.body;
        if (raw !== undefined && raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
          body = raw as { jobIds?: unknown };
        } else {
          body = {};
        }
      } catch {
        return reply.status(400).send({ error: "JSON invalido" });
      }

      const jobIds = Array.isArray(body.jobIds)
        ? body.jobIds.filter((id): id is string => typeof id === "string" && id.length > 0)
        : [];

      if (jobIds.length === 0) {
        return reply.status(400).send({ error: "jobIds e obrigatorio" });
      }

      try {
        const result = await svc.removeJobsFromBatch(batchId, jobIds);
        return reply.send(result);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("nao encontrado")) {
          return reply.status(404).send({ error: msg });
        }
        app.log.error({ err: e }, "[DELETE batch jobs]");
        return reply.status(500).send({ error: msg });
      }
    },
  );
}
