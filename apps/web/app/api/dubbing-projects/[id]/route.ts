import { forwardToApi } from "../../../../src/server/forward-to-api";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  return forwardToApi(request, `/api/dubbing-projects/${encodeURIComponent(id)}`);
}

export async function PATCH(request: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  return forwardToApi(request, `/api/dubbing-projects/${encodeURIComponent(id)}`);
}

export async function DELETE(request: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  return forwardToApi(request, `/api/dubbing-projects/${encodeURIComponent(id)}`);
}
