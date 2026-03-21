import { NextResponse } from "next/server";

import { getBatchJobService } from "../../../../../src/server/transcription/transcription-services";

type RouteParams = { params: Promise<{ batchId: string }> };

const OPENAI_HEADER = "x-openai-key";

export async function POST(request: Request, { params }: RouteParams) {
  const { batchId } = await params;
  if (!batchId) {
    return NextResponse.json({ error: "batchId obrigatorio" }, { status: 400 });
  }

  const openaiApiKey = request.headers.get(OPENAI_HEADER)?.trim() || undefined;

  const svc = getBatchJobService();
  void svc.processBatchSequential(batchId, openaiApiKey).catch((err) => {
    // eslint-disable-next-line no-console
    console.error("[batch-jobs/start]", batchId, err);
  });

  return NextResponse.json({ ok: true, started: true });
}
