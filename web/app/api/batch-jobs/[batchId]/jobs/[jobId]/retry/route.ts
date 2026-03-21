import { NextResponse } from "next/server";

import { prisma } from "../../../../../../../src/lib/prisma";
import { getTranscriptionJobService } from "../../../../../../../src/server/transcription/transcription-services";

type RouteParams = {
  params: Promise<{ batchId: string; jobId: string }>;
};

const OPENAI_HEADER = "x-openai-key";

export async function POST(request: Request, { params }: RouteParams) {
  const { batchId, jobId } = await params;
  if (!batchId || !jobId) {
    return NextResponse.json({ error: "batchId e jobId obrigatorios" }, { status: 400 });
  }

  const job = await prisma.transcriptionJob.findUnique({
    where: { id: jobId },
    select: { id: true, batchId: true },
  });

  if (!job || job.batchId !== batchId) {
    return NextResponse.json({ error: "Job nao encontrado neste batch" }, { status: 404 });
  }

  const openaiApiKey = request.headers.get(OPENAI_HEADER)?.trim() || undefined;

  const result = await getTranscriptionJobService().retry(jobId, {
    openaiApiKey,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, jobId });
}
