import { NextResponse } from "next/server";

const API_BASE_URL = process.env.API_BASE_URL?.trim() || "http://localhost:4000";

async function forwardUpstreamToNextResponse(upstream: Response): Promise<NextResponse> {
  if (upstream.status === 204 || upstream.status === 205 || upstream.status === 304) {
    return new NextResponse(null, { status: upstream.status });
  }
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
    },
  });
}

/**
 * Reencaminha resposta binária (ZIP, etc.) sem `text()` — preserva bytes e headers relevantes (PR 6.3.5+).
 */
async function forwardUpstreamBinaryToNextResponse(upstream: Response): Promise<NextResponse> {
  if (upstream.status === 204 || upstream.status === 205 || upstream.status === 304) {
    return new NextResponse(null, { status: upstream.status });
  }
  const buf = await upstream.arrayBuffer();
  const headers: Record<string, string> = {};
  const ct = upstream.headers.get("content-type");
  if (ct) headers["content-type"] = ct;
  const cd = upstream.headers.get("content-disposition");
  if (cd) headers["content-disposition"] = cd;
  const cc = upstream.headers.get("cache-control");
  if (cc) headers["cache-control"] = cc;
  const cl = upstream.headers.get("content-length");
  if (cl) headers["content-length"] = cl;
  const ar = upstream.headers.get("accept-ranges");
  if (ar) headers["accept-ranges"] = ar;
  const cr = upstream.headers.get("content-range");
  if (cr) headers["content-range"] = cr;
  return new NextResponse(buf, {
    status: upstream.status,
    headers,
  });
}

/**
 * Encaminha multipart para `apps/api` com corpo binário e `Content-Type` (incl. boundary).
 * Usar apenas onde o upstream espera `multipart/form-data` (PR 6.3.2+).
 */
export async function forwardMultipartToApi(
  request: Request,
  apiPath: string,
): Promise<NextResponse> {
  try {
    const contentType = request.headers.get("content-type");
    if (!contentType?.toLowerCase().includes("multipart/")) {
      return NextResponse.json({ error: "multipart invalido" }, { status: 400 });
    }
    const headers: Record<string, string> = {
      "content-type": contentType,
    };
    const openaiKey = request.headers.get("x-openai-key");
    if (openaiKey) {
      headers["x-openai-key"] = openaiKey;
    }
    // Node fetch exige `duplex: 'half'` ao reencaminhar o stream do body (multipart).
    const upstream = await fetch(`${API_BASE_URL}${apiPath}`, {
      method: request.method,
      cache: "no-store",
      headers,
      body: request.body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    return forwardUpstreamToNextResponse(upstream);
  } catch {
    return NextResponse.json({ error: "Falha ao comunicar com apps/api" }, { status: 502 });
  }
}

/**
 * Encaminha para `apps/api` com corpo de resposta em bytes (não usar para JSON de sucesso genérico).
 * Erros JSON da API continuam a ser repassados como bytes UTF-8 com `content-type: application/json`.
 */
export async function forwardBinaryToApi(request: Request, apiPath: string): Promise<NextResponse> {
  try {
    const init: RequestInit = {
      method: request.method,
      cache: "no-store",
    };
    const upstreamHeaders: Record<string, string> = {};
    const openaiKey = request.headers.get("x-openai-key");
    if (openaiKey) {
      upstreamHeaders["x-openai-key"] = openaiKey;
    }
    const range = request.headers.get("range");
    if (range) {
      upstreamHeaders["range"] = range;
    }
    if (Object.keys(upstreamHeaders).length > 0) {
      init.headers = upstreamHeaders;
    }
    const upstream = await fetch(`${API_BASE_URL}${apiPath}`, init);
    return forwardUpstreamBinaryToNextResponse(upstream);
  } catch {
    return NextResponse.json({ error: "Falha ao comunicar com apps/api" }, { status: 502 });
  }
}

/**
 * Encaminha o pedido para `apps/api` preservando método, body e Content-Type (PR 6.2.1+).
 */
export async function forwardToApi(request: Request, apiPath: string): Promise<NextResponse> {
  try {
    const init: RequestInit = {
      method: request.method,
      cache: "no-store",
    };
    const upstreamHeaders: Record<string, string> = {};
    const openaiKey = request.headers.get("x-openai-key");
    if (openaiKey) {
      upstreamHeaders["x-openai-key"] = openaiKey;
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      const rawBody = await request.text();
      if (rawBody !== "") {
        init.body = rawBody;
        const contentType = request.headers.get("content-type");
        if (contentType) {
          upstreamHeaders["content-type"] = contentType;
        } else if (request.method === "DELETE") {
          upstreamHeaders["content-type"] = "application/json";
        }
      }
    }
    if (Object.keys(upstreamHeaders).length > 0) {
      init.headers = upstreamHeaders;
    }
    const upstream = await fetch(`${API_BASE_URL}${apiPath}`, init);
    return forwardUpstreamToNextResponse(upstream);
  } catch {
    return NextResponse.json({ error: "Falha ao comunicar com apps/api" }, { status: 502 });
  }
}
