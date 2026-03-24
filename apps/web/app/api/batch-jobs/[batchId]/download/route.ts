import { NextResponse } from "next/server";

import { forwardBinaryToApi } from "../../../../../src/server/forward-to-api";

type RouteParams = { params: Promise<{ batchId: string }> };

export async function GET(request: Request, { params }: RouteParams) {
  const { batchId } = await params;
  if (!batchId) {
    return NextResponse.json({ error: "batchId obrigatorio" }, { status: 400 });
  }

  return forwardBinaryToApi(
    request,
    `/api/batch-jobs/${encodeURIComponent(batchId)}/download`,
  );
}
