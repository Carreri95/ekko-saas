import { NextResponse } from "next/server";

import { prisma } from "../../../../src/lib/prisma";

type RouteParams = { params: Promise<{ cueId: string }> };

type Body = {
  text?: string;
  startMs?: number;
  endMs?: number;
};

export async function PATCH(request: Request, { params }: RouteParams) {
  const { cueId } = await params;
  if (!cueId) {
    return NextResponse.json({ error: "cueId obrigatorio" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Body JSON invalido" }, { status: 400 });
  }

  const existing = await prisma.subtitleCue.findUnique({
    where: { id: cueId },
    select: { id: true, subtitleFileId: true, startMs: true, endMs: true, text: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Cue nao encontrada" }, { status: 404 });
  }

  const startMs = body.startMs !== undefined ? Math.trunc(body.startMs) : existing.startMs;
  const endMs = body.endMs !== undefined ? Math.trunc(body.endMs) : existing.endMs;
  const text = body.text !== undefined ? body.text : existing.text;

  if (startMs >= endMs) {
    return NextResponse.json({ error: "startMs deve ser menor que endMs" }, { status: 400 });
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

  return NextResponse.json(updated);
}
