import type { FastifyInstance } from "fastify";

import { getSubtitleFileDetail } from "./subtitle-file-detail.service.js";
import { getSubtitleFileAudio } from "./subtitle-file-audio.service.js";
import { getSubtitleFileSrtExport } from "./subtitle-file-export.service.js";

function parseSingleRangeHeader(rangeHeader: string, total: number): { start: number; end: number } | null {
  const raw = rangeHeader.trim().toLowerCase();
  if (!raw.startsWith("bytes=")) return null;
  const spec = raw.slice("bytes=".length).trim();
  if (!spec || spec.includes(",")) return null;
  const [startRaw, endRaw] = spec.split("-");
  if (startRaw === undefined || endRaw === undefined) return null;

  // bytes=-N (sufixo)
  if (!startRaw && endRaw) {
    const suffixLen = Number(endRaw);
    if (!Number.isFinite(suffixLen) || suffixLen <= 0) return null;
    const len = Math.min(total, Math.floor(suffixLen));
    return { start: Math.max(0, total - len), end: total - 1 };
  }

  const start = Number(startRaw);
  if (!Number.isFinite(start) || start < 0) return null;
  const startInt = Math.floor(start);
  if (startInt >= total) return null;

  if (!endRaw) {
    return { start: startInt, end: total - 1 };
  }
  const end = Number(endRaw);
  if (!Number.isFinite(end) || end < 0) return null;
  const endInt = Math.floor(end);
  if (endInt < startInt) return null;
  return { start: startInt, end: Math.min(total - 1, endInt) };
}

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
    const rangeHeader = request.headers.range;
    const range = typeof rangeHeader === "string" ? parseSingleRangeHeader(rangeHeader, contentLength) : null;

    if (typeof rangeHeader === "string" && !range) {
      return reply
        .status(416)
        .header("Accept-Ranges", "bytes")
        .header("Content-Range", `bytes */${contentLength}`)
        .send();
    }

    if (range) {
      const chunk = buffer.subarray(range.start, range.end + 1);
      return reply
        .status(206)
        .header("Accept-Ranges", "bytes")
        .header("Content-Range", `bytes ${range.start}-${range.end}/${contentLength}`)
        .header("Content-Type", contentType)
        .header("Content-Disposition", contentDisposition)
        .header("Cache-Control", "no-store")
        .header("Content-Length", String(chunk.byteLength))
        .send(chunk);
    }

    return reply
      .status(200)
      .header("Accept-Ranges", "bytes")
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
