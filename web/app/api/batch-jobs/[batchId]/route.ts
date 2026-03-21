import { NextResponse } from "next/server";

import { getBatchJobService } from "../../../../src/server/transcription/transcription-services";

type RouteParams = { params: Promise<{ batchId: string }> };

export async function GET(_: Request, { params }: RouteParams) {
  const { batchId } = await params;
  if (!batchId) {
    return NextResponse.json({ error: "batchId obrigatorio" }, { status: 400 });
  }

  const status = await getBatchJobService().getBatchStatus(batchId);
  if (!status) {
    return NextResponse.json({ error: "Batch nao encontrado" }, { status: 404 });
  }

  return NextResponse.json(status);
}
