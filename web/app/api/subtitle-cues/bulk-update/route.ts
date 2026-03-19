import { NextResponse } from "next/server";

import { prisma } from "../../../../src/lib/prisma";
import { formatSrt } from "../../../../src/lib/srt/format-srt";

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

export async function POST(request: Request) {
  let body: BulkUpdateBody;

  try {
    body = (await request.json()) as BulkUpdateBody;
  } catch {
    return NextResponse.json({ error: "Body JSON invalido" }, { status: 400 });
  }

  const { subtitleFileId, cues } = body ?? {};

  if (!subtitleFileId || !Array.isArray(cues)) {
    return NextResponse.json(
      { error: "subtitleFileId e cues sao obrigatorios" },
      { status: 400 }
    );
  }

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    if (!isValidCuePayload(cue)) {
      return NextResponse.json(
        { error: `Cue invalido no payload (indice ${i})` },
        { status: 400 }
      );
    }

    if (cue.startMs >= cue.endMs) {
      return NextResponse.json(
        { error: `startMs deve ser menor que endMs (cueId: ${cue.id}, indice ${i})` },
        { status: 400 }
      );
    }
  }

  const subtitleFile = await prisma.subtitleFile.findUnique({
    where: { id: subtitleFileId },
    select: { id: true },
  });

  if (!subtitleFile) {
    return NextResponse.json({ error: "SubtitleFile nao encontrado" }, { status: 404 });
  }

  const cueIds = cues
    .map((c) => c.id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const uniqueCueIds = new Set(cueIds);
  if (uniqueCueIds.size !== cueIds.length) {
    return NextResponse.json({ error: "IDs de cue duplicados no payload" }, { status: 400 });
  }

  const existingCues = await prisma.subtitleCue.findMany({
    where: {
      subtitleFileId,
    },
    select: { id: true },
  });

  const existingCueIds = new Set(existingCues.map((cue) => cue.id));
  const hasUnknownCueId = cueIds.some((cueId) => !existingCueIds.has(cueId));
  if (hasUnknownCueId) {
    return NextResponse.json(
      { error: "Um ou mais cues nao pertencem ao SubtitleFile informado" },
      { status: 400 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
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
      })
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

  return NextResponse.json({
    subtitleFileId,
    updatedCount: cues.length,
    versionId: result.version.id,
    versionNumber: result.version.versionNumber,
    versionCreatedAt: result.version.createdAt,
    cues: result.currentCues,
  });
}

