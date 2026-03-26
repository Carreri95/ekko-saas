import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  castMemberAvailabilityCreateSchema,
  castMemberAvailabilityPatchSchema,
} from "./schemas.js";
import { CastMemberAvailabilityService } from "./service.js";

type ParamsId = { id: string };
type ParamsAvail = { id: string; availabilityId: string };

export async function registerCastMemberAvailabilityRoutes(app: FastifyInstance) {
  const service = new CastMemberAvailabilityService();

  app.get<{ Params: ParamsId }>(
    "/api/cast-members/:id/availability",
    async (request, reply) => {
      const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: "id obrigatório" });
      const result = await service.list(params.data.id);
      if ("notFound" in result) return reply.code(404).send({ error: "Não encontrado" });
      return reply.send(result);
    },
  );

  app.post<{ Params: ParamsId }>(
    "/api/cast-members/:id/availability",
    async (request, reply) => {
      const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
      if (!params.success) return reply.code(400).send({ error: "id obrigatório" });
      const parsed = castMemberAvailabilityCreateSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Dados inválidos",
          details: parsed.error.flatten().fieldErrors,
        });
      }
      const result = await service.create(params.data.id, parsed.data);
      if ("notFound" in result) return reply.code(404).send({ error: "Não encontrado" });
      if ("badRequest" in result) return reply.code(400).send(result.badRequest);
      return reply.code(201).send(result);
    },
  );

  app.patch<{ Params: ParamsAvail }>(
    "/api/cast-members/:id/availability/:availabilityId",
    async (request, reply) => {
      const params = z
        .object({ id: z.string().min(1), availabilityId: z.string().min(1) })
        .safeParse(request.params);
      if (!params.success) {
        return reply.code(400).send({ error: "Parâmetros inválidos" });
      }
      const parsed = castMemberAvailabilityPatchSchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Dados inválidos",
          details: parsed.error.flatten().fieldErrors,
        });
      }
      const result = await service.patch(
        params.data.id,
        params.data.availabilityId,
        parsed.data,
      );
      if ("notFound" in result) return reply.code(404).send({ error: "Não encontrado" });
      if ("badRequest" in result) return reply.code(400).send(result.badRequest);
      return reply.send(result);
    },
  );

  app.delete<{ Params: ParamsAvail }>(
    "/api/cast-members/:id/availability/:availabilityId",
    async (request, reply) => {
      const params = z
        .object({ id: z.string().min(1), availabilityId: z.string().min(1) })
        .safeParse(request.params);
      if (!params.success) {
        return reply.code(400).send({ error: "Parâmetros inválidos" });
      }
      const result = await service.remove(params.data.id, params.data.availabilityId);
      if ("notFound" in result) return reply.code(404).send({ error: "Não encontrado" });
      return reply.send(result);
    },
  );
}
