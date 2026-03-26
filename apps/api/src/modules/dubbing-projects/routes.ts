import type { FastifyInstance } from "fastify";
import {
  characterCreateSchema,
  characterPatchSchema,
  dubbingProjectFormSchema,
  dubbingProjectPatchRequestSchema,
  dubbingProjectStatusEnum,
  episodePatchSchema,
  episodeTranscriptionBodySchema,
} from "./schemas.js";
import { DubbingProjectsService } from "./service.js";

type ParamsId = { id: string };
type ParamsCharacter = { id: string; charId: string };
type ParamsEpisode = { id: string; epId: string };
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

  app.get<{ Params: ParamsId }>("/api/dubbing-projects/:id/episodes", async (request, reply) => {
    const result = await service.listEpisodes(request.params.id);
    if (!result) return reply.code(404).send({ error: "Não encontrado" });
    return reply.send(result);
  });

  app.get<{ Params: ParamsId }>("/api/dubbing-projects/:id/episodes/export", async (request, reply) => {
    const result = await service.exportDoneEpisodesSrtZip(request.params.id);
    if ("notFound" in result) {
      return reply.code(404).send({ error: "Não encontrado" });
    }
    if ("noDoneEpisodes" in result) {
      return reply.code(404).send({ error: "Nenhum episódio concluído para exportar" });
    }
    if ("subtitleReadFailed" in result) {
      const n = result.subtitleReadFailed.episodeNumber;
      return reply.code(500).send({
        error: `Falha ao ler legenda do episódio ${n}.`,
      });
    }
    return reply
      .header("Content-Type", "application/zip")
      .header("Content-Disposition", `attachment; filename="${result.ok.filename}"`)
      .send(result.ok.buffer);
  });

  app.get<{ Params: ParamsEpisode }>(
    "/api/dubbing-projects/:id/episodes/:epId",
    async (request, reply) => {
      const result = await service.getEpisode(request.params.id, request.params.epId);
      if (!result) return reply.code(404).send({ error: "Não encontrado" });
      return reply.send(result);
    },
  );

  app.post<{ Params: ParamsEpisode }>(
    "/api/dubbing-projects/:id/episodes/:epId/audio",
    async (request, reply) => {
      const dubbingId = request.params.id;
      const epId = request.params.epId;
      if (!request.isMultipart()) {
        return reply.code(400).send({ error: "multipart invalido" });
      }
      let file;
      try {
        file = await request.file();
      } catch {
        return reply.code(400).send({ error: "multipart invalido" });
      }
      if (!file || file.fieldname !== "file") {
        return reply.code(400).send({ error: "Campo file e obrigatorio" });
      }
      const buffer = await file.toBuffer();
      const mimeType = file.mimetype || "application/octet-stream";
      const originalFilename = file.filename || null;
      const result = await service.uploadEpisodeAudio(dubbingId, epId, {
        buffer,
        mimeType,
        originalFilename,
      });
      if ("notFound" in result) return reply.code(404).send({ error: "Não encontrado" });
      if ("badRequest" in result) return reply.code(400).send(result.badRequest);
      if ("unprocessable" in result) return reply.code(422).send(result.unprocessable);
      return reply.send(result);
    },
  );

  app.post<{ Params: ParamsEpisode }>(
    "/api/dubbing-projects/:id/episodes/:epId/transcriptions",
    async (request, reply) => {
      const parsed = episodeTranscriptionBodySchema.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.code(400).send({
          error: "Dados inválidos",
          details: parsed.error.flatten().fieldErrors,
        });
      }
      const result = await service.startEpisodeTranscription(request.params.id, request.params.epId, {
        language: parsed.data.language ?? null,
      });
      if ("notFound" in result) return reply.code(404).send({ error: "Não encontrado" });
      if ("badRequest" in result) return reply.code(400).send(result.badRequest);
      return reply.send(result);
    },
  );

  app.patch<{ Params: ParamsEpisode }>("/api/dubbing-projects/:id/episodes/:epId", async (request, reply) => {
    const parsed = episodePatchSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Dados inválidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const result = await service.patchEpisode(request.params.id, request.params.epId, parsed.data);
    if ("notFound" in result) return reply.code(404).send({ error: "Não encontrado" });
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
