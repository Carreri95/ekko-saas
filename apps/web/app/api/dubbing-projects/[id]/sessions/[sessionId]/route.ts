import { forwardToApi } from "../../../../../../src/server/forward-to-api";

type RouteContext = { params: Promise<{ id: string; sessionId: string }> };

export async function PATCH(request: Request, ctx: RouteContext) {
  const { id, sessionId } = await ctx.params;
  return forwardToApi(
    request,
    `/api/dubbing-projects/${encodeURIComponent(id)}/sessions/${encodeURIComponent(sessionId)}`,
  );
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const { id, sessionId } = await ctx.params;
  return forwardToApi(
    request,
    `/api/dubbing-projects/${encodeURIComponent(id)}/sessions/${encodeURIComponent(sessionId)}`,
  );
}
