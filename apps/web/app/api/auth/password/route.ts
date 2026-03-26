import { forwardToApi } from "../../../../src/server/forward-to-api";

export async function PATCH(request: Request) {
  return forwardToApi(request, "/api/auth/password");
}
