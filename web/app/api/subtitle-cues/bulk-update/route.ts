import { NextResponse } from "next/server";

import { prisma } from "../../../../src/lib/prisma";

type CueUpdateInput = {
  id: string;
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
    typeof c.id === "string" &&
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

  const cueIds = cues.map((c) => c.id);
  const uniqueCueIds = new Set(cueIds);
  if (uniqueCueIds.size !== cueIds.length) {
    return NextResponse.json({ error: "IDs de cue duplicados no payload" }, { status: 400 });
  }

  const ownedCount = await prisma.subtitleCue.count({
    where: {
      subtitleFileId,
      id: { in: cueIds },
    },
  });

  if (ownedCount !== cueIds.length) {
    return NextResponse.json(
      { error: "Um ou mais cues nao pertencem ao SubtitleFile informado" },
      { status: 400 }
    );
  }

  if (cues.length > 0) {
    await prisma.$transaction(
      cues.map((cue) =>
        prisma.subtitleCue.update({
          where: { id: cue.id },
          data: {
            startMs: Math.trunc(cue.startMs),
            endMs: Math.trunc(cue.endMs),
            text: cue.text,
          },
        })
      )
    );
  }

  return NextResponse.json({
    subtitleFileId,
    updatedCount: cues.length,
  });
}

