import { NextResponse } from "next/server";

import { forwardToApi } from "../../../../../src/server/forward-to-api";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const { id: projectId } = await params;
  if (!projectId) {
    return NextResponse.json({ error: "projectId obrigatorio" }, { status: 400 });
  }
  return forwardToApi(request, `/api/projects/${encodeURIComponent(projectId)}/transcriptions`);
}
