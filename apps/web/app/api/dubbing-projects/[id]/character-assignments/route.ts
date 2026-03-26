import { forwardToApi } from "../../../../../src/server/forward-to-api";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const url = new URL(request.url);
  const characterId = url.searchParams.get("characterId");
  const query = characterId ? `?characterId=${encodeURIComponent(characterId)}` : "";
  return forwardToApi(
    request,
    `/api/dubbing-projects/${encodeURIComponent(id)}/character-assignments${query}`,
  );
}

export async function POST(request: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  return forwardToApi(
    request,
    `/api/dubbing-projects/${encodeURIComponent(id)}/character-assignments`,
  );
}
