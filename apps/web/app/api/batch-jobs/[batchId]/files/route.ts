import { NextResponse } from "next/server";

import { forwardMultipartToApi } from "../../../../../src/server/forward-to-api";

type RouteParams = { params: Promise<{ batchId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const { batchId } = await params;
  if (!batchId) {
    return NextResponse.json({ error: "batchId obrigatorio" }, { status: 400 });
  }
  return forwardMultipartToApi(request, `/api/batch-jobs/${encodeURIComponent(batchId)}/files`);
}
