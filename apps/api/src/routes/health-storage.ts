import type { FastifyInstance } from "fastify";
import { checkStorageHealth } from "../infrastructure/storage/storage-health.service.js";

/**
 * Endpoint operacional de diagnóstico — não é usado pelo frontend de produto.
 * GET /health — continua independente; não exige MinIO.
 */
export async function registerStorageHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health/storage", async (_request, reply) => {
    const result = await checkStorageHealth();

    if (result.ok && result.mode === "disabled") {
      return reply.status(200).send({
        ok: true,
        storage: "disabled",
        message: result.message,
      });
    }

    if (!result.ok && result.mode === "misconfigured") {
      return reply.status(503).send({
        ok: false,
        storage: "misconfigured",
        error: result.message,
      });
    }

    if (result.ok && result.mode === "ok") {
      return reply.status(200).send({
        ok: true,
        storage: "ok",
        buckets: result.buckets,
      });
    }

    return reply.status(503).send({
      ok: false,
      storage: "unreachable",
      error: result.message,
    });
  });
}
