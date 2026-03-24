import { NextResponse } from "next/server";

import { forwardBinaryToApi } from "../../../../../src/server/forward-to-api";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * PR 5.5: boundary HTTP em `apps/api`; mesmo contrato que o handler legado.
 */
export async function GET(request: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "subtitleFileId obrigatorio" }, { status: 400 });
  }

  return forwardBinaryToApi(
    request,
    `/api/subtitle-files/${encodeURIComponent(id)}/audio`,
  );
}
