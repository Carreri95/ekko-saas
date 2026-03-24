import { NextResponse } from "next/server";

import { forwardMultipartToApi } from "../../../../../src/server/forward-to-api";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PR 5.1: boundary HTTP em `apps/api`; mesmo contrato que o handler legado.
 */
export async function POST(request: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "projectId obrigatorio" }, { status: 400 });
  }

  const contentType = request.headers.get("content-type");
  if (!contentType || !contentType.toLowerCase().includes("multipart/form-data")) {
    return NextResponse.json({ error: "multipart invalido" }, { status: 400 });
  }

  return forwardMultipartToApi(
    request,
    `/api/projects/${encodeURIComponent(id)}/media`,
  );
}
