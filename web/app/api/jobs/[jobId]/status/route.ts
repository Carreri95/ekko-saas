import { NextResponse } from "next/server";

import { prisma } from "../../../../../src/lib/prisma";

type RouteParams = { params: Promise<{ jobId: string }> };

export async function GET(_: Request, { params }: RouteParams) {
  const { jobId } = await params;
  if (!jobId) {
    return NextResponse.json({ error: "jobId obrigatorio" }, { status: 400 });
  }

  const job = await prisma.transcriptionJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      status: true,
      errorMessage: true,
      attemptCount: true,
      projectId: true,
      subtitleFileId: true,
      engine: true,
      language: true,
      startedAt: true,
      completedAt: true,
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Job nao encontrado" }, { status: 404 });
  }

  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    progress: null,
    errorMessage: job.errorMessage,
    attemptCount: job.attemptCount,
    projectId: job.projectId,
    subtitleFileId: job.subtitleFileId,
    engine: job.engine,
    language: job.language,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
  });
}
