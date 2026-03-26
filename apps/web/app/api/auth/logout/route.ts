import { forwardToApi } from "../../../../src/server/forward-to-api";

export async function POST(request: Request) {
  return forwardToApi(request, "/api/auth/logout");
}
