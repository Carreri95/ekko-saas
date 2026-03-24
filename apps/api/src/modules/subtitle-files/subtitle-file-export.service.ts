import { prisma } from "../../infrastructure/db/prisma.client.js";
import { formatSrt } from "../projects/srt/format-srt.js";

function toDownloadFilename(filename: string): string {
  const trimmed = filename.trim();
  const fallback = "subtitle-file";
  const base = trimmed.length > 0 ? trimmed : fallback;
  return base.toLowerCase().endsWith(".srt") ? base : `${base}.srt`;
}

/**
 * GET /api/subtitle-files/:id/export — mesmo contrato que o handler legado no Next (PR 7.3).
 */
export async function getSubtitleFileSrtExport(id: string): Promise<
  | { badRequest: string }
  | { notFound: string }
  | { ok: { body: Buffer; downloadFilename: string } }
> {
  if (!id) {
    return { badRequest: "subtitleFileId obrigatorio" };
  }

  const subtitleFile = await prisma.subtitleFile.findUnique({
    where: { id },
    select: {
      id: true,
      filename: true,
      cues: {
        orderBy: { cueIndex: "asc" },
        select: {
          cueIndex: true,
          startMs: true,
          endMs: true,
          text: true,
        },
      },
    },
  });

  if (!subtitleFile) {
    return { notFound: "SubtitleFile nao encontrado" };
  }

  const srtContent = formatSrt(subtitleFile.cues);
  const downloadFilename = toDownloadFilename(subtitleFile.filename);
  const body = Buffer.from(srtContent, "utf8");

  return { ok: { body, downloadFilename } };
}
