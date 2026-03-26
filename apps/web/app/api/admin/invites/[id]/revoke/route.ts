import { forwardToApi } from "../../../../../../src/server/forward-to-api";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  return forwardToApi(
    request,
    `/api/admin/invites/${encodeURIComponent(id)}/revoke`,
  );
}
