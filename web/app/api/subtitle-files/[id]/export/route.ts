import { prisma } from "../../../../../src/lib/prisma";
import { formatSrt } from "../../../../../src/lib/srt/format-srt";

type RouteParams = {
  params: Promise<{ id: string }>;
};

function toDownloadFilename(filename: string): string {
  const trimmed = filename.trim();
  const fallback = "subtitle-file";
  const base = trimmed.length > 0 ? trimmed : fallback;
  return base.toLowerCase().endsWith(".srt") ? base : `${base}.srt`;
}

export async function GET(_: Request, { params }: RouteParams) {
  const { id } = await params;

  if (!id) {
    return new Response("subtitleFileId obrigatorio", { status: 400 });
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
    return new Response("SubtitleFile nao encontrado", { status: 404 });
  }

  const srtContent = formatSrt(subtitleFile.cues);
  const downloadFilename = toDownloadFilename(subtitleFile.filename);

  return new Response(srtContent, {
    status: 200,
    headers: {
      "Content-Type": "application/x-subrip; charset=utf-8",
      "Content-Disposition": `attachment; filename="${downloadFilename}"`,
      "Cache-Control": "no-store",
    },
  });
}

