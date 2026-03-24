import { forwardToApi } from "../../../../../src/server/forward-to-api";

type RouteContext = { params: Promise<{ id: string }> };

/** GET /api/cast-members/[id]/castings — personagens / projetos do dublador */
export async function GET(request: Request, ctx: RouteContext) {
  const { id: castMemberId } = await ctx.params;
  return forwardToApi(
    request,
    `/api/cast-members/${encodeURIComponent(castMemberId)}/castings`,
  );
}
