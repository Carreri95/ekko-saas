import { NextResponse } from "next/server";

import { prisma } from "../../../../src/lib/prisma";
import { findLatestSubtitleFileForProject } from "../../../../src/server/subtitle-file-queries";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Metadados do projeto (sem cues). Útil para dashboards ou para obter storage/duração
 * antes de abrir o editor.
 */
export async function GET(_: Request, { params }: RouteParams) {
  const { id: projectId } = await params;
  if (!projectId) {
    return NextResponse.json({ error: "projectId obrigatorio" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      storageKey: true,
      mediaKind: true,
      durationMs: true,
      createdAt: true,
      updatedAt: true,
      userId: true,
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Projeto nao encontrado" }, { status: 404 });
  }

  const latestFile = await findLatestSubtitleFileForProject(prisma, projectId);

  return NextResponse.json({
    ...project,
    /** SubtitleFile mais recente do projeto, se existir (para ligar ao editor). */
    subtitleFileId: latestFile?.id ?? null,
  });
}
