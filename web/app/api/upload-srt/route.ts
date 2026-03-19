import { NextResponse } from "next/server";

import { prisma } from "../../../src/lib/prisma";
import { parseSrt } from "../../../src/lib/srt/parse-srt";

type UploadSrtRequestBody = {
  projectId: string;
  filename: string;
  srtContent: string;
};

export async function POST(request: Request) {
  let body: UploadSrtRequestBody;

  try {
    body = (await request.json()) as UploadSrtRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Body JSON invalido" },
      { status: 400 }
    );
  }

  const { projectId, filename, srtContent } = body ?? {};

  if (!projectId || !filename || !srtContent) {
    return NextResponse.json(
      { error: "projectId, filename e srtContent sao obrigatorios" },
      { status: 400 }
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Projeto nao encontrado" }, { status: 404 });
  }

  let cues;
  try {
    cues = parseSrt(srtContent);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: `Falha ao parsear SRT: ${message}` },
      { status: 400 }
    );
  }

  const subtitleFile = await prisma.subtitleFile.create({
    data: {
      projectId,
      filename,
      // language opcional (mantemos null no MVP)
    },
    select: { id: true },
  });

  if (cues.length > 0) {
    await prisma.subtitleCue.createMany({
      data: cues.map((cue) => ({
        subtitleFileId: subtitleFile.id,
        cueIndex: cue.cueIndex,
        startMs: cue.startMs,
        endMs: cue.endMs,
        text: cue.text,
      })),
    });
  }

  return NextResponse.json({
    subtitleFileId: subtitleFile.id,
    cuesCount: cues.length,
    filename,
  });
}

