import { NextResponse } from "next/server";

import { forwardToApi } from "../../../../../../../src/server/forward-to-api";

type RouteParams = {
  params: Promise<{ batchId: string; jobId: string }>;
};

export async function POST(request: Request, { params }: RouteParams) {
  const { batchId, jobId } = await params;
  if (!batchId || !jobId) {
    return NextResponse.json({ error: "batchId e jobId obrigatorios" }, { status: 400 });
  }
  return forwardToApi(
    request,
    `/api/batch-jobs/${encodeURIComponent(batchId)}/jobs/${encodeURIComponent(jobId)}/retry`,
  );
}
