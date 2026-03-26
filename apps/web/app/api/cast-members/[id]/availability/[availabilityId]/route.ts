import { forwardToApi } from "../../../../../../src/server/forward-to-api";

type RouteContext = {
  params: Promise<{ id: string; availabilityId: string }>;
};

export async function PATCH(request: Request, ctx: RouteContext) {
  const { id, availabilityId } = await ctx.params;
  return forwardToApi(
    request,
    `/api/cast-members/${encodeURIComponent(id)}/availability/${encodeURIComponent(availabilityId)}`,
  );
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const { id, availabilityId } = await ctx.params;
  return forwardToApi(
    request,
    `/api/cast-members/${encodeURIComponent(id)}/availability/${encodeURIComponent(availabilityId)}`,
  );
}
