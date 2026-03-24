import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { runSubtitleCuesBulkUpdate } from "./cue-bulk-update.service.js";
import { patchSubtitleCue } from "./cue-patch.service.js";

function isPatchBody(raw: unknown): raw is { text?: string; startMs?: number; endMs?: number } {
  if (raw === undefined || raw === null) return true;
  if (typeof raw !== "object" || Array.isArray(raw)) return false;
  return true;
}

/**
 * Rotas HTTP de cues. PR 7.2: PATCH /api/cues/:cueId. PR 7.4: POST bulk-update + cues/batch.
 * Plugin encapsulado para alinhar erro de JSON inválido ao legado (`Body JSON invalido`).
 */
export async function registerCueRoutes(app: FastifyInstance): Promise<void> {
  await app.register(async (inner) => {
    inner.setErrorHandler((error, _request, reply) => {
      const code = (error as { code?: string }).code;
      if (code === "FST_ERR_CTP_INVALID_JSON_BODY") {
        return reply.status(400).send({ error: "Body JSON invalido" });
      }
      return reply.send(error);
    });

    async function postSubtitleCuesBulkUpdate(
      request: FastifyRequest,
      reply: FastifyReply,
    ): Promise<void> {
      const result = await runSubtitleCuesBulkUpdate(request.body);
      if (result.status === 400) {
        await reply.status(400).send(result.body);
        return;
      }
      if (result.status === 404) {
        await reply.status(404).send(result.body);
        return;
      }
      await reply.status(200).send(result.body);
    }

    inner.post("/api/subtitle-cues/bulk-update", postSubtitleCuesBulkUpdate);
    inner.post("/api/cues/batch", postSubtitleCuesBulkUpdate);

    inner.patch<{ Params: { cueId: string }; Body: unknown }>(
      "/api/cues/:cueId",
      async (request, reply) => {
        const cueId = request.params.cueId;
        if (!cueId) {
          return reply.status(400).send({ error: "cueId obrigatorio" });
        }

        const raw = request.body;
        if (!isPatchBody(raw)) {
          return reply.status(400).send({ error: "Body JSON invalido" });
        }

        const result = await patchSubtitleCue(cueId, raw);

        if ("badRequest" in result) {
          return reply.status(400).send(result.badRequest);
        }
        if ("notFound" in result) {
          return reply.status(404).send(result.notFound);
        }
        if ("validation" in result) {
          return reply.status(400).send(result.validation);
        }

        return reply.send(result.ok);
      },
    );
  });
}
