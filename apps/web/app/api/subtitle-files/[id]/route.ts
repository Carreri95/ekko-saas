import { NextResponse } from "next/server";

import { forwardToApi } from "../../../../src/server/forward-to-api";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "subtitleFileId obrigatorio" }, { status: 400 });
  }

  return forwardToApi(request, `/api/subtitle-files/${encodeURIComponent(id)}`);
}
