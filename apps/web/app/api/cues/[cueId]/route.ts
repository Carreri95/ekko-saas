import { NextResponse } from "next/server";

import { forwardToApi } from "../../../../src/server/forward-to-api";

type RouteParams = { params: Promise<{ cueId: string }> };

export async function PATCH(request: Request, { params }: RouteParams) {
  const { cueId } = await params;
  if (!cueId) {
    return NextResponse.json({ error: "cueId obrigatorio" }, { status: 400 });
  }

  return forwardToApi(request, `/api/cues/${encodeURIComponent(cueId)}`);
}
