import { prisma } from "../../infrastructure/db/prisma.client.js";

/**
 * GET /api/subtitle-files/:id — mesmo contrato que o handler legado no Next (PR 7.1).
 */
export async function getSubtitleFileDetail(id: string): Promise<
  | { badRequest: { error: string } }
  | { notFound: { error: string } }
  | {
      ok: {
        subtitleFileId: string;
        filename: string;
        wavFilename: string | null;
        wavPath: string | null;
        projectId: string;
        cues: Array<{
          id: string;
          cueIndex: number;
          startMs: number;
          endMs: number;
          text: string | null;
        }>;
      };
    }
> {
  if (!id) {
    return { badRequest: { error: "subtitleFileId obrigatorio" } };
  }

  const subtitleFile = await prisma.subtitleFile.findUnique({
    where: { id },
    select: {
      id: true,
      filename: true,
      wavFilename: true,
      wavPath: true,
      projectId: true,
      cues: {
        orderBy: { cueIndex: "asc" },
        select: {
          id: true,
          cueIndex: true,
          startMs: true,
          endMs: true,
          text: true,
        },
      },
    },
  });

  if (!subtitleFile) {
    return { notFound: { error: "SubtitleFile nao encontrado" } };
  }

  return {
    ok: {
      subtitleFileId: subtitleFile.id,
      filename: subtitleFile.filename,
      wavFilename: subtitleFile.wavFilename,
      wavPath: subtitleFile.wavPath,
      projectId: subtitleFile.projectId,
      cues: subtitleFile.cues,
    },
  };
}
