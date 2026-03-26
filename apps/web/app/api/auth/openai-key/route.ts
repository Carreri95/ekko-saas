import { forwardToApi } from "../../../../src/server/forward-to-api";

export async function GET(request: Request) {
  return forwardToApi(request, "/api/auth/openai-key");
}

export async function PUT(request: Request) {
  return forwardToApi(request, "/api/auth/openai-key");
}

export async function DELETE(request: Request) {
  return forwardToApi(request, "/api/auth/openai-key");
}

