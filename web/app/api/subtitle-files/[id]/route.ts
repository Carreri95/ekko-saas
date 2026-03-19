import { NextResponse } from "next/server";

import { prisma } from "../../../../src/lib/prisma";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: RouteParams) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "subtitleFileId obrigatorio" }, { status: 400 });
  }

  const subtitleFile = await prisma.subtitleFile.findUnique({
    where: { id },
    select: {
      id: true,
      filename: true,
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
    return NextResponse.json({ error: "SubtitleFile nao encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    subtitleFileId: subtitleFile.id,
    filename: subtitleFile.filename,
    projectId: subtitleFile.projectId,
    cues: subtitleFile.cues,
  });
}

