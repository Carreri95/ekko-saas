import { NextResponse } from "next/server";

import { TranscriptionEngine } from "../../../../generated/prisma/client";
import { prisma } from "../../../../../src/lib/prisma";
import { findLatestSubtitleFileForProject } from "../../../../../src/server/subtitle-file-queries";
import { getTranscriptionJobService } from "../../../../../src/server/transcription/transcription-services";

type RouteParams = { params: Promise<{ id: string }> };

type Body = {
  engine?: string;
  language?: string;
  prompt?: string;
};

export async function POST(request: Request, { params }: RouteParams) {
  const { id: projectId } = await params;
  if (!projectId) {
    return NextResponse.json({ error: "projectId obrigatorio" }, { status: 400 });
  }

  let body: Body = {};
  try {
    const text = await request.text();
    if (text && text.trim() !== "") {
      body = JSON.parse(text) as Body;
    }
  } catch {
    return NextResponse.json({ error: "Body JSON invalido" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, storageKey: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Projeto nao encontrado" }, { status: 404 });
  }

  if (!project.storageKey) {
    return NextResponse.json(
      { error: "Nenhuma midia no projeto. Faca POST /api/projects/:id/media primeiro." },
      { status: 400 },
    );
  }

  const subtitleFile = await findLatestSubtitleFileForProject(prisma, projectId);
  if (!subtitleFile) {
    return NextResponse.json(
      { error: "SubtitleFile nao encontrado para o projeto. Faca upload de midia primeiro." },
      { status: 400 },
    );
  }

  const engine =
    body.engine?.toUpperCase() === "MOCK"
      ? TranscriptionEngine.MOCK
      : TranscriptionEngine.OPENAI_WHISPER;

  const svc = getTranscriptionJobService();
  const job = await svc.createAndEnqueue({
    projectId,
    subtitleFileId: subtitleFile.id,
    engine,
    language: body.language ?? null,
    prompt: body.prompt ?? null,
  });

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
  });
}
