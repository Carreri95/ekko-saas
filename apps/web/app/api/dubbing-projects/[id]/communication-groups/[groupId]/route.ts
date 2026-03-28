import { forwardToApi } from "../../../../../../src/server/forward-to-api";

type RouteContext = { params: Promise<{ id: string; groupId: string }> };

export async function PATCH(request: Request, ctx: RouteContext) {
  const { id, groupId } = await ctx.params;
  return forwardToApi(
    request,
    `/api/dubbing-projects/${encodeURIComponent(id)}/communication-groups/${encodeURIComponent(groupId)}`,
  );
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const { id, groupId } = await ctx.params;
  return forwardToApi(
    request,
    `/api/dubbing-projects/${encodeURIComponent(id)}/communication-groups/${encodeURIComponent(groupId)}`,
  );
}
