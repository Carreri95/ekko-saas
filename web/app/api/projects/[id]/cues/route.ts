import { NextResponse } from "next/server";

import { prisma } from "../../../../../src/lib/prisma";
import { findLatestSubtitleFileForProject } from "../../../../../src/server/subtitle-file-queries";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: RouteParams) {
  const { id: projectId } = await params;
  if (!projectId) {
    return NextResponse.json({ error: "projectId obrigatorio" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Projeto nao encontrado" }, { status: 404 });
  }

  const subtitleFile = await findLatestSubtitleFileForProject(prisma, projectId);
  if (!subtitleFile) {
    return NextResponse.json(
      { error: "Nenhum SubtitleFile para este projeto" },
      { status: 404 },
    );
  }

  const cues = await prisma.subtitleCue.findMany({
    where: { subtitleFileId: subtitleFile.id },
    orderBy: { cueIndex: "asc" },
    select: {
      id: true,
      cueIndex: true,
      startMs: true,
      endMs: true,
      text: true,
      transcriptionJobId: true,
    },
  });

  return NextResponse.json({
    projectId,
    subtitleFileId: subtitleFile.id,
    cues,
  });
}
