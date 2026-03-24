import type { FastifyInstance } from "fastify";
import {
  characterCreateSchema,
  characterPatchSchema,
  dubbingProjectFormSchema,
  dubbingProjectPatchRequestSchema,
  dubbingProjectStatusEnum,
} from "./schemas.js";
import { DubbingProjectsService } from "./service.js";

type ParamsId = { id: string };
type ParamsCharacter = { id: string; charId: string };
type QueryList = { status?: string; q?: string; page?: string };

export async function registerDubbingProjectRoutes(app: FastifyInstance) {
  const service = new DubbingProjectsService();

  app.get<{ Querystring: QueryList }>("/api/dubbing-projects", async (request, reply) => {
    const status = request.query.status;
    if (status && !dubbingProjectStatusEnum.options.includes(status as never)) {
      return reply.code(400).send({ error: "status inválido" });
    }
    const result = await service.list(request.query);
    return reply.send(result);
  });

  app.post("/api/dubbing-projects", async (request, reply) => {
    const parsed = dubbingProjectFormSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Dados inválidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const raw = (request.body ?? {}) as Record<string, unknown>;
    const result = await service.create(parsed.data, raw.userId);
    if ("badRequest" in result) {
      return reply.code(400).send(result.badRequest);
    }
    return reply.code(201).send(result);
  });

  app.get<{ Params: ParamsId }>("/api/dubbing-projects/:id", async (request, reply) => {
    const result = await service.getById(request.params.id);
    if (!result) return reply.code(404).send({ error: "Não encontrado" });
    return reply.send(result);
  });

  app.patch<{ Params: ParamsId }>("/api/dubbing-projects/:id", async (request, reply) => {
    const parsed = dubbingProjectPatchRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Dados inválidos",
        details: parsed.error.flatten(),
      });
    }

    const raw = (request.body ?? {}) as Record<string, unknown>;
    const result = await service.patch(request.params.id, parsed.data, raw);
    if ("notFound" in result) return reply.code(404).send({ error: "Não encontrado" });
    if ("badRequest" in result) return reply.code(400).send(result.badRequest);
    return reply.send(result);
  });

  app.delete<{ Params: ParamsId }>("/api/dubbing-projects/:id", async (request, reply) => {
    const result = await service.remove(request.params.id);
    if ("notFound" in result) return reply.code(404).send({ error: "Não encontrado" });
    return reply.code(204).send();
  });

  app.get<{ Params: ParamsId }>("/api/dubbing-projects/:id/characters", async (request, reply) => {
    const result = await service.listCharacters(request.params.id);
    if (!result) return reply.code(404).send({ error: "Não encontrado" });
    return reply.send(result);
  });

  app.post<{ Params: ParamsId }>("/api/dubbing-projects/:id/characters", async (request, reply) => {
    const parsed = characterCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Dados inválidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const result = await service.createCharacter(request.params.id, parsed.data);
    if ("notFound" in result) return reply.code(404).send({ error: "Não encontrado" });
    return reply.code(201).send(result);
  });

  app.patch<{ Params: ParamsCharacter }>(
    "/api/dubbing-projects/:id/characters/:charId",
    async (request, reply) => {
      const parsed = characterPatchSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Dados inválidos",
          details: parsed.error.flatten().fieldErrors,
        });
      }
      const result = await service.patchCharacter(request.params.id, request.params.charId, parsed.data);
      if ("notFound" in result) return reply.code(404).send({ error: "Não encontrado" });
      return reply.send(result);
    },
  );

  app.delete<{ Params: ParamsCharacter }>(
    "/api/dubbing-projects/:id/characters/:charId",
    async (request, reply) => {
      const result = await service.deleteCharacter(request.params.id, request.params.charId);
      if ("notFound" in result) return reply.code(404).send({ error: "Não encontrado" });
      return reply.send(result);
    },
  );
}
