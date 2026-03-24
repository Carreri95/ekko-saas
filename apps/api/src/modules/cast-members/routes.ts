import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { CastMembersService } from "./service.js";
import { castMemberFormSchema, castMemberPatchSchema } from "./schemas.js";

const STATUS_SET = new Set(["AVAILABLE", "BUSY", "INACTIVE"]);

export async function registerCastMemberRoutes(app: FastifyInstance): Promise<void> {
  const service = new CastMembersService();

  app.get("/api/cast-members", async (request, reply) => {
    const q = String((request.query as Record<string, unknown>)?.q ?? "").trim();
    const status = String((request.query as Record<string, unknown>)?.status ?? "");
    const page = (request.query as Record<string, unknown>)?.page;

    if (status && !STATUS_SET.has(status)) {
      return reply.status(400).send({ error: "status inválido" });
    }

    const payload = await service.list({
      q,
      status,
      page: page == null ? null : String(page),
    });
    return reply.send(payload);
  });

  app.post("/api/cast-members", async (request, reply) => {
    const parsed = castMemberFormSchema.safeParse(request.body ?? {});
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

  app.get("/api/cast-members/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ error: "id obrigatorio" });
    const payload = await service.getById(params.data.id);
    if (!payload) return reply.status(404).send({ error: "Não encontrado" });
    return reply.send(payload);
  });

  app.patch("/api/cast-members/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ error: "id obrigatorio" });
    const parsed = castMemberPatchSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Dados inválidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const result = await service.patch(params.data.id, parsed.data);
    if ("notFound" in result) return reply.status(404).send({ error: "Não encontrado" });
    if ("conflict" in result) return reply.status(409).send(result.conflict);
    return reply.send(result);
  });

  app.delete("/api/cast-members/:id", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ error: "id obrigatorio" });
    await service.remove(params.data.id);
    return reply.send({ ok: true });
  });

  app.get("/api/cast-members/:id/castings", async (request, reply) => {
    const params = z.object({ id: z.string().min(1) }).safeParse(request.params);
    if (!params.success) return reply.status(400).send({ error: "id obrigatorio" });
    const payload = await service.castings(params.data.id);
    if (!payload) return reply.status(404).send({ error: "Não encontrado" });
    return reply.send(payload);
  });
}
