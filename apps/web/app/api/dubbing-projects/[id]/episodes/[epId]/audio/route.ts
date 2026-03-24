import { NextResponse } from "next/server";

import { forwardMultipartToApi } from "../../../../../../../src/server/forward-to-api";

type RouteContext = { params: Promise<{ id: string; epId: string }> };

export async function POST(request: Request, ctx: RouteContext) {
  const { id, epId } = await ctx.params;
  if (!id?.trim() || !epId?.trim()) {
    return NextResponse.json({ error: "id ou epId obrigatorio" }, { status: 400 });
  }

  const contentType = request.headers.get("content-type");
  if (!contentType || !contentType.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json({ error: "multipart invalido" }, { status: 400 });
  }

  return forwardMultipartToApi(
    request,
    `/api/dubbing-projects/${encodeURIComponent(id)}/episodes/${encodeURIComponent(epId)}/audio`,
  );
}
