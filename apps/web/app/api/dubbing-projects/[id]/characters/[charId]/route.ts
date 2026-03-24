import { forwardToApi } from "../../../../../../src/server/forward-to-api";

type RouteContext = { params: Promise<{ id: string; charId: string }> };

export async function PATCH(request: Request, ctx: RouteContext) {
  const { id, charId } = await ctx.params;
  return forwardToApi(
    request,
    `/api/dubbing-projects/${encodeURIComponent(id)}/characters/${encodeURIComponent(charId)}`,
  );
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const { id, charId } = await ctx.params;
  return forwardToApi(
    request,
    `/api/dubbing-projects/${encodeURIComponent(id)}/characters/${encodeURIComponent(charId)}`,
  );
}
