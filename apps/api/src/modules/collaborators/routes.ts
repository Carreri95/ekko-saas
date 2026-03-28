import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { CollaboratorsService } from "./service.js";
import { collaboratorFormSchema, collaboratorPatchSchema } from "./schemas.js";

const ROLE_SET = new Set([
  "RECORDING_TECHNICIAN",
  "POST_PRODUCTION",
  "MIXER",
  "PRE_PRODUCTION",
]);

export async function registerCollaboratorRoutes(app: FastifyInstance): Promise<void> {
  const service = new CollaboratorsService();

  app.get("/api/collaborators", async (request, reply) => {
    const q = String((request.query as Record<string, unknown>)?.q ?? "").trim();
    const role = String((request.query as Record<string, unknown>)?.role ?? "");
    const page = (request.query as Record<string, unknown>)?.page;

    if (role && !ROLE_SET.has(role)) {
      return reply.status(400).send({ error: "role inválida" });
    }

    const payload = await service.list({
      q,
      role,
      page: page == null ? null : String(page),
    });
    return reply.send(payload);
  });

  app.post("/api/collaborators", async (request, reply) => {
    const parsed = collaboratorFormSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Dados inválidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const result = await service.create(parsed.data);
    if ("conflict" in result) {
      return reply.status(409).send(result.conflict);
    }
    return reply.status(201).send(result);
  });

  app.get("/api/collaborators/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ error: "id obrigatorio" });
    const payload = await service.getById(params.data.id);
    if (!payload) return reply.status(404).send({ error: "Não encontrado" });
    return reply.send(payload);
  });

  app.patch("/api/collaborators/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ error: "id obrigatorio" });
    const parsed = collaboratorPatchSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Dados inválidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const result = await service.patch(params.data.id, parsed.data);
    if ("notFound" in result) return reply.status(404).send({ error: "Não encontrado" });
    if ("badRequest" in result) return reply.status(400).send(result.badRequest);
    if ("conflict" in result) return reply.status(409).send(result.conflict);
    return reply.send(result);
  });

  app.delete("/api/collaborators/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ error: "id obrigatorio" });
    await service.remove(params.data.id);
    return reply.send({ ok: true });
  });
}
