import { NextResponse } from "next/server";

import { forwardToApi } from "../../../../../src/server/forward-to-api";

type RouteParams = { params: Promise<{ jobId: string }> };

/**
 * PR 6.2.2: boundary HTTP em `apps/api`; mesmo contrato que o handler legado.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const { jobId } = await params;
  if (!jobId) {
    return NextResponse.json({ error: "jobId obrigatorio" }, { status: 400 });
  }
  return forwardToApi(request, `/api/jobs/${encodeURIComponent(jobId)}/reprocess-normalization`);
}
