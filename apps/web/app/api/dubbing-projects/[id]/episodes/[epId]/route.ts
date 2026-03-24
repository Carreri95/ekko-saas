import { forwardToApi } from "../../../../../../src/server/forward-to-api";

type RouteContext = { params: Promise<{ id: string; epId: string }> };

export async function PATCH(request: Request, ctx: RouteContext) {
  const { id, epId } = await ctx.params;
  return forwardToApi(
    request,
    `/api/dubbing-projects/${encodeURIComponent(id)}/episodes/${encodeURIComponent(epId)}`,
  );
}
