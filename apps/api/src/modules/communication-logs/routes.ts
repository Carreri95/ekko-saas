import type { FastifyInstance } from "fastify";
import {
  communicationLogCreateSchema,
  communicationLogPatchSchema,
} from "./schemas.js";
import { CommunicationLogsService } from "./service.js";

type ParamsProject = { id: string };
type ParamsLog = { id: string; logId: string };

export async function registerCommunicationLogRoutes(app: FastifyInstance) {
  const service = new CommunicationLogsService();

  app.get<{ Params: ParamsProject }>(
    "/api/dubbing-projects/:id/communication-logs",
    async (request, reply) => {
      const result = await service.list(request.params.id);
      if ("notFound" in result) return reply.code(404).send({ error: "Não encontrado" });
      return reply.send(result);
    },
  );

  app.post<{ Params: ParamsProject }>(
    "/api/dubbing-projects/:id/communication-logs",
    async (request, reply) => {
      const parsed = communicationLogCreateSchema.safeParse(request.body);
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
    },
  );

  app.patch<{ Params: ParamsLog }>(
    "/api/dubbing-projects/:id/communication-logs/:logId",
    async (request, reply) => {
      const parsed = communicationLogPatchSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Dados inválidos",
          details: parsed.error.flatten().fieldErrors,
        });
      }
      const result = await service.patch(request.params.id, request.params.logId, parsed.data);
      if ("notFound" in result) return reply.code(404).send({ error: "Não encontrado" });
      if ("badRequest" in result) return reply.code(400).send(result.badRequest);
      return reply.send(result);
    },
  );

  app.delete<{ Params: ParamsLog }>(
    "/api/dubbing-projects/:id/communication-logs/:logId",
    async (request, reply) => {
      const result = await service.remove(request.params.id, request.params.logId);
      if ("notFound" in result) return reply.code(404).send({ error: "Não encontrado" });
      return reply.code(204).send();
    },
  );

  app.post<{ Params: ParamsLog }>(
    "/api/dubbing-projects/:id/communication-logs/:logId/send",
    async (request, reply) => {
      const result = await service.enqueueSend(request.params.id, request.params.logId);
      if ("notFound" in result) return reply.code(404).send({ error: "Não encontrado" });
      if ("badRequest" in result) return reply.code(400).send(result.badRequest);
      if ("conflict" in result) return reply.code(409).send(result.conflict);
      if ("queued" in result) return reply.code(202).send(result);
      return reply.send(result);
    },
  );
}
