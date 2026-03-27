import { forwardToApi } from "../../../../../src/server/forward-to-api";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  return forwardToApi(
    request,
    `/api/dubbing-projects/${encodeURIComponent(id)}/communication-logs`,
  );
}

export async function POST(request: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  return forwardToApi(
    request,
    `/api/dubbing-projects/${encodeURIComponent(id)}/communication-logs`,
  );
}
