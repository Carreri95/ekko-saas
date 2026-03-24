import type { FastifyInstance } from "fastify";
import { ProjectsService } from "./service.js";

export async function registerProjectRoutes(app: FastifyInstance): Promise<void> {
  const service = new ProjectsService();

  app.post<{ Params: { id: string } }>("/api/projects/:id/media", async (request, reply) => {
    const projectId = request.params.id;
    if (!projectId?.trim()) {
      return reply.status(400).send({ error: "projectId obrigatorio" });
    }

    if (!request.isMultipart()) {
      return reply.status(400).send({ error: "multipart invalido" });
    }

    let file;
    try {
      file = await request.file();
    } catch {
      return reply.status(400).send({ error: "multipart invalido" });
    }

    if (!file || file.fieldname !== "file") {
      return reply.status(400).send({ error: "Campo file e obrigatorio" });
    }

    const buffer = await file.toBuffer();
    const mimeType = file.mimetype || "application/octet-stream";
    const originalFilename = file.filename || null;

    const result = await service.postProjectMedia(projectId, {
      buffer,
      mimeType,
      originalFilename,
    });

    if ("notFound" in result) {
      return reply.status(404).send(result.notFound);
    }
    if ("badRequest" in result) {
      return reply.status(400).send(result.badRequest);
    }
    return reply.send(result.ok);
  });

  app.get<{ Params: { id: string } }>("/api/projects/:id/cues", async (request, reply) => {
    const result = await service.getCues(request.params.id);
    if ("badRequest" in result) {
      return reply.status(400).send(result.badRequest);
    }
    if ("notFound" in result) {
      return reply.status(404).send(result.notFound);
    }
    if ("noSubtitleFile" in result) {
      return reply.status(404).send(result.noSubtitleFile);
    }
    return reply.send(result.ok);
  });

  app.get<{ Params: { id: string } }>("/api/projects/:id/export/srt", async (request, reply) => {
    const result = await service.exportSrt(request.params.id);
    if ("badRequest" in result) {
      return reply.status(400).send(result.badRequest);
    }
    if ("notFound" in result) {
      return reply.status(404).send(result.notFound);
    }
    if ("noSubtitleFile" in result) {
      return reply.status(404).send(result.noSubtitleFile);
    }
    return reply
      .type("text/plain; charset=utf-8")
      .header("Content-Disposition", result.ok.contentDisposition)
      .header("Cache-Control", "no-store")
      .send(result.ok.body);
  });

  app.post("/api/projects", async (request, reply) => {
    const result = await service.create(request.body ?? {});
    if ("badRequest" in result) {
      return reply.status(400).send(result.badRequest);
    }
    if ("serverError" in result) {
      return reply.status(500).send(result.serverError);
    }
    if ("serviceUnavailable" in result) {
      return reply.status(503).send(result.serviceUnavailable);
    }
    return reply.status(201).send(result.created);
  });

  app.get<{ Params: { id: string } }>("/api/projects/:id", async (request, reply) => {
    const result = await service.getById(request.params.id);
    if ("badRequest" in result) {
      return reply.status(400).send(result.badRequest);
    }
    if ("notFound" in result) {
      return reply.status(404).send(result.notFound);
    }
    return reply.send(result.ok);
  });
}
