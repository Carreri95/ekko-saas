import type { FastifyInstance } from "fastify";

import { getSubtitleFileDetail } from "./subtitle-file-detail.service.js";
import { getSubtitleFileAudio } from "./subtitle-file-audio.service.js";
import { getSubtitleFileSrtExport } from "./subtitle-file-export.service.js";

export async function registerSubtitleFileRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>("/api/subtitle-files/:id/audio", async (request, reply) => {
    const id = request.params.id;
    const result = await getSubtitleFileAudio(id);

    if ("badRequest" in result) {
      return reply.status(400).send(result.badRequest);
    }
    if ("notFound" in result) {
      return reply.status(404).send(result.notFound);
    }
    if ("notConfigured" in result) {
      return reply.status(404).send(result.notConfigured);
    }
    if ("notFoundOnDisk" in result) {
      return reply.status(404).send(result.notFoundOnDisk);
    }
    if ("serverError" in result) {
      return reply.status(500).send(result.serverError);
    }

    const { buffer, contentType, contentDisposition, contentLength } = result.ok;
    return reply
      .header("Content-Type", contentType)
      .header("Content-Disposition", contentDisposition)
      .header("Cache-Control", "no-store")
      .header("Content-Length", String(contentLength))
      .send(buffer);
  });

  app.get<{ Params: { id: string } }>("/api/subtitle-files/:id/export", async (request, reply) => {
    const id = request.params.id;
    const result = await getSubtitleFileSrtExport(id);

    if ("badRequest" in result) {
      return reply.status(400).type("text/plain; charset=utf-8").send(result.badRequest);
    }
    if ("notFound" in result) {
      return reply.status(404).type("text/plain; charset=utf-8").send(result.notFound);
    }

    const { body, downloadFilename } = result.ok;
    return reply
      .status(200)
      .header("Content-Type", "application/x-subrip; charset=utf-8")
      .header("Content-Disposition", `attachment; filename="${downloadFilename}"`)
      .header("Cache-Control", "no-store")
      .header("Content-Length", String(body.length))
      .send(body);
  });

  app.get<{ Params: { id: string } }>("/api/subtitle-files/:id", async (request, reply) => {
    const id = request.params.id;
    const result = await getSubtitleFileDetail(id);

    if ("badRequest" in result) {
      return reply.status(400).send(result.badRequest);
    }
    if ("notFound" in result) {
      return reply.status(404).send(result.notFound);
    }

    return reply.send(result.ok);
  });
}
