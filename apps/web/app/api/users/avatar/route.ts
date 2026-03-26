import { forwardMultipartToApi } from "../../../../src/server/forward-to-api";

export async function POST(request: Request) {
  return forwardMultipartToApi(request, "/api/users/avatar");
}
