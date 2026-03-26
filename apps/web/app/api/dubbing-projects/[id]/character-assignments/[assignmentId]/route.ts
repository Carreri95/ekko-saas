import { forwardToApi } from "../../../../../../src/server/forward-to-api";

type RouteContext = { params: Promise<{ id: string; assignmentId: string }> };

export async function PATCH(request: Request, ctx: RouteContext) {
  const { id, assignmentId } = await ctx.params;
  return forwardToApi(
    request,
    `/api/dubbing-projects/${encodeURIComponent(id)}/character-assignments/${encodeURIComponent(assignmentId)}`,
  );
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const { id, assignmentId } = await ctx.params;
  return forwardToApi(
    request,
    `/api/dubbing-projects/${encodeURIComponent(id)}/character-assignments/${encodeURIComponent(assignmentId)}`,
  );
}
