import { forwardToApi } from "../../../../src/server/forward-to-api";

export async function GET(request: Request) {
  return forwardToApi(request, "/api/admin/invites");
}

export async function POST(request: Request) {
  return forwardToApi(request, "/api/admin/invites");
}
