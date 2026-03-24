import { NextResponse } from "next/server";

import { forwardToApi } from "../../../../../src/server/forward-to-api";

type RouteParams = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const { jobId } = await params;
  if (!jobId) {
    return NextResponse.json({ error: "jobId obrigatorio" }, { status: 400 });
  }
  return forwardToApi(request, `/api/jobs/${encodeURIComponent(jobId)}/retry`);
}
