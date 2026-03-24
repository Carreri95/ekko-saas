import { prisma } from "../../infrastructure/db/prisma.client.js";

type PatchBody = {
  text?: string;
  startMs?: number;
  endMs?: number;
};

/**
 * PATCH /api/cues/:cueId — mesmo comportamento que o handler legado no Next (PR 7.2).
 */
export async function patchSubtitleCue(
  cueId: string,
  body: PatchBody,
): Promise<
  | { badRequest: { error: string } }
  | { notFound: { error: string } }
  | { validation: { error: string } }
  | {
      ok: {
        id: string;
        cueIndex: number;
        startMs: number;
        endMs: number;
        text: string | null;
        subtitleFileId: string;
      };
    }
> {
  if (!cueId) {
    return { badRequest: { error: "cueId obrigatorio" } };
  }

  const existing = await prisma.subtitleCue.findUnique({
    where: { id: cueId },
    select: { id: true, subtitleFileId: true, startMs: true, endMs: true, text: true },
  });

  if (!existing) {
    return { notFound: { error: "Cue nao encontrada" } };
  }

  const startMs = body.startMs !== undefined ? Math.trunc(body.startMs) : existing.startMs;
  const endMs = body.endMs !== undefined ? Math.trunc(body.endMs) : existing.endMs;
  const text = body.text !== undefined ? body.text : existing.text;

  if (startMs >= endMs) {
    return { validation: { error: "startMs deve ser menor que endMs" } };
  }

  const updated = await prisma.subtitleCue.update({
    where: { id: cueId },
    data: { startMs, endMs, text },
    select: {
      id: true,
      cueIndex: true,
      startMs: true,
      endMs: true,
      text: true,
      subtitleFileId: true,
    },
  });

  return { ok: updated };
}
