import { forwardToApi } from "../../../src/server/forward-to-api";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return forwardToApi(request, `/api/cast-members${url.search}`);
}

export async function POST(request: Request) {
  return forwardToApi(request, "/api/cast-members");
}
