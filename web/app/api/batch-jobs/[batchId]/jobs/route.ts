import { NextResponse } from "next/server";

import { getBatchJobService } from "../../../../../src/server/transcription/transcription-services";

type RouteParams = { params: Promise<{ batchId: string }> };

export async function DELETE(request: Request, { params }: RouteParams) {
  const { batchId } = await params;
  if (!batchId) {
    return NextResponse.json({ error: "batchId obrigatorio" }, { status: 400 });
  }

  let body: { jobIds?: unknown };
  try {
    body = (await request.json()) as { jobIds?: unknown };
  } catch {
    return NextResponse.json({ error: "JSON invalido" }, { status: 400 });
  }

  const jobIds = Array.isArray(body.jobIds)
    ? body.jobIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];

  if (jobIds.length === 0) {
    return NextResponse.json({ error: "jobIds e obrigatorio" }, { status: 400 });
  }

  try {
    const result = await getBatchJobService().removeJobsFromBatch(batchId, jobIds);
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("nao encontrado")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    console.error("[DELETE batch jobs]", e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
