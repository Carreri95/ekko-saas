import type { FastifyInstance } from "fastify";
import {
  recordingSessionCreateSchema,
  recordingSessionPatchSchema,
} from "./schemas.js";
import { RecordingSessionsService } from "./service.js";

type ParamsProject = { id: string };
type ParamsSession = { id: string; sessionId: string };

export async function registerRecordingSessionRoutes(app: FastifyInstance) {
  const service = new RecordingSessionsService();

  app.get<{ Params: ParamsProject }>("/api/dubbing-projects/:id/sessions", async (request, reply) => {
    const result = await service.list(request.params.id);
    if ("notFound" in result) return reply.code(404).send({ error: "Não encontrado" });
    return reply.send(result);
  });

  app.post<{ Params: ParamsProject }>("/api/dubbing-projects/:id/sessions", async (request, reply) => {
    const parsed = recordingSessionCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Dados inválidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const result = await service.create(request.params.id, parsed.data);
    if ("notFound" in result) return reply.code(404).send({ error: "Não encontrado" });
    if ("badRequest" in result) return reply.code(400).send(result.badRequest);
    return reply.code(201).send(result);
  });

  app.patch<{ Params: ParamsSession }>(
    "/api/dubbing-projects/:id/sessions/:sessionId",
    async (request, reply) => {
      const parsed = recordingSessionPatchSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Dados inválidos",
          details: parsed.error.flatten().fieldErrors,
        });
      }
      const result = await service.patch(request.params.id, request.params.sessionId, parsed.data);
      if ("notFound" in result) return reply.code(404).send({ error: "Não encontrado" });
      if ("badRequest" in result) return reply.code(400).send(result.badRequest);
      return reply.send(result);
    },
  );

  app.delete<{ Params: ParamsSession }>(
    "/api/dubbing-projects/:id/sessions/:sessionId",
    async (request, reply) => {
      const result = await service.remove(request.params.id, request.params.sessionId);
      if ("notFound" in result) return reply.code(404).send({ error: "Não encontrado" });
      return reply.send(result);
    },
  );
}
