import { forwardToApi } from "../../../../src/server/forward-to-api";

export async function GET(request: Request) {
  return forwardToApi(request, "/api/auth/me");
}
