import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/db/prisma.client.js";
import { formatSrt } from "../projects/srt/format-srt.js";

type CueUpdateInput = {
  id?: string;
  startMs: number;
  endMs: number;
  text: string;
};

type BulkUpdateBody = {
  subtitleFileId: string;
  cues: CueUpdateInput[];
};

function isValidCuePayload(cue: unknown): cue is CueUpdateInput {
  if (!cue || typeof cue !== "object") return false;

  const c = cue as Record<string, unknown>;
  return (
    (typeof c.id === "undefined" || typeof c.id === "string") &&
    Number.isFinite(c.startMs) &&
    Number.isFinite(c.endMs) &&
    typeof c.text === "string"
  );
}

export type CueBulkUpdateResult =
  | { status: 400; body: { error: string } }
  | { status: 404; body: { error: string } }
  | {
      status: 200;
      body: {
        subtitleFileId: string;
        updatedCount: number;
        versionId: string;
        versionNumber: number;
        versionCreatedAt: Date;
        cues: Array<{
          id: string;
          cueIndex: number;
          startMs: number;
          endMs: number;
          text: string | null;
        }>;
      };
    };

/**
 * POST /api/subtitle-cues/bulk-update — lift-and-shift do legado Next (PR 7.4).
 */
export async function runSubtitleCuesBulkUpdate(rawBody: unknown): Promise<CueBulkUpdateResult> {
  const body = (rawBody ?? {}) as BulkUpdateBody;
  const { subtitleFileId, cues } = body ?? {};

  if (!subtitleFileId || !Array.isArray(cues)) {
    return {
      status: 400,
      body: { error: "subtitleFileId e cues sao obrigatorios" },
    };
  }

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (!isValidCuePayload(cue)) {
      return {
        status: 400,
        body: { error: `Cue invalido no payload (indice ${i})` },
      };
    }

    if (cue.startMs >= cue.endMs) {
      return {
        status: 400,
        body: {
          error: `startMs deve ser menor que endMs (cueId: ${cue.id}, indice ${i})`,
        },
      };
    }
  }

  const subtitleFile = await prisma.subtitleFile.findUnique({
    where: { id: subtitleFileId },
    select: { id: true },
  });

  if (!subtitleFile) {
    return { status: 404, body: { error: "SubtitleFile nao encontrado" } };
  }

  const cueIds = cues
    .map((c) => c.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const uniqueCueIds = new Set(cueIds);
  if (uniqueCueIds.size !== cueIds.length) {
    return { status: 400, body: { error: "IDs de cue duplicados no payload" } };
  }

  const existingCues = await prisma.subtitleCue.findMany({
    where: {
      subtitleFileId,
    },
    select: { id: true },
  });

  const existingCueIds = new Set(
    existingCues.map((cue: { id: string }) => cue.id),
  );
  const hasUnknownCueId = cueIds.some((cueId) => !existingCueIds.has(cueId));
  if (hasUnknownCueId) {
    return {
      status: 400,
      body: { error: "Um ou mais cues nao pertencem ao SubtitleFile informado" },
    };
  }

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (cueIds.length > 0) {
      await tx.subtitleCue.deleteMany({
        where: {
          subtitleFileId,
          id: { notIn: cueIds },
        },
      });
    } else {
      await tx.subtitleCue.deleteMany({
        where: { subtitleFileId },
      });
    }

    await Promise.all(
      cues.map((cue, index) => {
        const data = {
          cueIndex: index + 1,
          startMs: Math.trunc(cue.startMs),
          endMs: Math.trunc(cue.endMs),
          text: cue.text,
        };

        if (cue.id && existingCueIds.has(cue.id)) {
          return tx.subtitleCue.update({
            where: { id: cue.id },
            data,
          });
        }

        return tx.subtitleCue.create({
          data: {
            subtitleFileId,
            ...data,
          },
        });
      }),
    );

    const currentCues = await tx.subtitleCue.findMany({
      where: { subtitleFileId },
      orderBy: { cueIndex: "asc" },
      select: {
        id: true,
        cueIndex: true,
        startMs: true,
        endMs: true,
        text: true,
      },
    });

    const snapshotContent = formatSrt(currentCues);

    const latestVersion = await tx.subtitleVersion.findFirst({
      where: { subtitleFileId },
      orderBy: { versionNumber: "desc" },
      select: { versionNumber: true },
    });

    const nextVersionNumber = (latestVersion?.versionNumber ?? 0) + 1;

    const version = await tx.subtitleVersion.create({
      data: {
        subtitleFileId,
        versionNumber: nextVersionNumber,
        srtContent: snapshotContent,
      },
      select: { id: true, versionNumber: true, createdAt: true },
    });

    return { version, currentCues };
  });

  return {
    status: 200,
    body: {
      subtitleFileId,
      updatedCount: cues.length,
      versionId: result.version.id,
      versionNumber: result.version.versionNumber,
      versionCreatedAt: result.version.createdAt,
      cues: result.currentCues,
    },
  };
}
