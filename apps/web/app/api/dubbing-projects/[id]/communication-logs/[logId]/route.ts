import { forwardToApi } from "../../../../../../src/server/forward-to-api";

type RouteContext = { params: Promise<{ id: string; logId: string }> };

export async function PATCH(request: Request, ctx: RouteContext) {
  const { id, logId } = await ctx.params;
  return forwardToApi(
    request,
    `/api/dubbing-projects/${encodeURIComponent(id)}/communication-logs/${encodeURIComponent(logId)}`,
  );
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const { id, logId } = await ctx.params;
  return forwardToApi(
    request,
    `/api/dubbing-projects/${encodeURIComponent(id)}/communication-logs/${encodeURIComponent(logId)}`,
  );
}
