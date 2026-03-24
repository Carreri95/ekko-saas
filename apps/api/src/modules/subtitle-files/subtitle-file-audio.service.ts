import { readFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "../../infrastructure/db/prisma.client.js";
import { resolveAudioPath } from "./audio-resolve-path.js";

function mimeFromFilename(name: string): string {
  const ext = path.extname(name).toLowerCase();
  switch (ext) {
    case ".mp3":
      return "audio/mpeg";
    case ".m4a":
      return "audio/mp4";
    case ".webm":
      return "audio/webm";
    case ".wav":
      return "audio/wav";
    default:
      return "application/octet-stream";
  }
}

export type SubtitleFileAudioResult =
  | {
      ok: {
        buffer: Buffer;
        contentType: string;
        contentDisposition: string;
        contentLength: number;
      };
    }
  | { badRequest: { error: string } }
  | { notFound: { error: string } }
  | { notConfigured: { error: string } }
  | {
      notFoundOnDisk: {
        error: string;
        wavPath: string;
        wavFilename: string | null;
        cwd: string;
        tried: string[];
      };
    }
  | { serverError: { error: string } };

/**
 * GET /api/subtitle-files/:id/audio — mesma semântica que o handler Next legado (PR 5.5).
 */
export async function getSubtitleFileAudio(subtitleFileId: string): Promise<SubtitleFileAudioResult> {
  if (!subtitleFileId?.trim()) {
    return { badRequest: { error: "subtitleFileId obrigatorio" } };
  }

  try {
    const subtitleFile = await prisma.subtitleFile.findUnique({
      where: { id: subtitleFileId },
      select: {
        wavPath: true,
        wavFilename: true,
      },
    });

    if (!subtitleFile) {
      return { notFound: { error: "SubtitleFile nao encontrado" } };
    }

    if (!subtitleFile.wavPath) {
      return { notConfigured: { error: "Arquivo de audio nao configurado" } };
    }

    const { resolved: diskPath, tried } = await resolveAudioPath(
      subtitleFile.wavPath,
      subtitleFile.wavFilename,
    );

    if (!diskPath) {
      return {
        notFoundOnDisk: {
          error: "Arquivo de audio nao encontrado no disco",
          wavPath: subtitleFile.wavPath,
          wavFilename: subtitleFile.wavFilename,
          cwd: process.cwd(),
          tried,
        },
      };
    }

    const buffer = await readFile(diskPath);
    const filename = subtitleFile.wavFilename ?? path.basename(diskPath);
    const contentType = mimeFromFilename(filename);
    const contentDisposition = `inline; filename="${filename}"`;

    return {
      ok: {
        buffer,
        contentType,
        contentDisposition,
        contentLength: buffer.byteLength,
      },
    };
  } catch (e) {
    console.error("[subtitle-file-audio] GET failed", e);
    return { serverError: { error: "Falha interna ao servir audio" } };
  }
}
