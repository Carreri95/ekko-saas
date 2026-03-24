import { NextResponse } from "next/server";

import { forwardToApi } from "../../../../../src/server/forward-to-api";

type RouteParams = { params: Promise<{ batchId: string }> };

export async function DELETE(request: Request, { params }: RouteParams) {
  const { batchId } = await params;
  if (!batchId) {
    return NextResponse.json({ error: "batchId obrigatorio" }, { status: 400 });
  }
  return forwardToApi(request, `/api/batch-jobs/${encodeURIComponent(batchId)}/jobs`);
}
