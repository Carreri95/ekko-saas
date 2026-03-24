import { forwardBinaryToApi } from "../../../../../src/server/forward-to-api";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, { params }: RouteParams) {
  const { id } = await params;
  if (!id) {
    return new Response("subtitleFileId obrigatorio", { status: 400 });
  }
  return forwardBinaryToApi(request, `/api/subtitle-files/${encodeURIComponent(id)}/export`);
}
