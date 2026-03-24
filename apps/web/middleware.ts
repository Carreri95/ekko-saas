import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Proteção opcional em produção:
 * - API_SECRET: exige Authorization: Bearer <secret> ou X-API-Key: <secret> em /api/*
 * - API_RATE_LIMIT_PER_MINUTE: limite por IP (janela fixa de 1 min). 0 = desligado.
 *
 * Com API_SECRET ativo, chamadas fetch do browser precisam do header (ou o segredo fica
 * exposto). Em geral: proxy reverso + auth, NextAuth, ou não definir API_SECRET até haver BFF.
 */

function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

type Bucket = { count: number; resetAt: number };

function getRateLimitStore(): Map<string, Bucket> {
  const g = globalThis as unknown as { __subtitlebotRl?: Map<string, Bucket> };
  if (!g.__subtitlebotRl) {
    g.__subtitlebotRl = new Map();
  }
  return g.__subtitlebotRl;
}

function checkRateLimit(ip: string, maxPerMinute: number): boolean {
  if (maxPerMinute <= 0) return true;
  const now = Date.now();
  const windowMs = 60_000;
  const store = getRateLimitStore();
  const key = ip;
  let b = store.get(key);
  if (!b || now >= b.resetAt) {
    b = { count: 1, resetAt: now + windowMs };
    store.set(key, b);
    return true;
  }
  if (b.count >= maxPerMinute) {
    return false;
  }
  b.count += 1;
  return true;
}

function validateApiSecret(request: NextRequest, secret: string): boolean {
  const auth = request.headers.get("authorization");
  const bearer =
    auth?.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : null;
  const apiKey = request.headers.get("x-api-key");
  if (bearer === secret) return true;
  if (apiKey === secret) return true;
  return false;
}

export function middleware(request: NextRequest) {
  if (request.method === "OPTIONS") {
    return NextResponse.next();
  }

  const secret = process.env.API_SECRET?.trim();
  if (secret) {
    if (!validateApiSecret(request, secret)) {
      return NextResponse.json(
        { error: "Nao autorizado. Defina Authorization: Bearer ou X-API-Key." },
        { status: 401 },
      );
    }
  }

  const maxPerMin = Number.parseInt(
    process.env.API_RATE_LIMIT_PER_MINUTE ?? "0",
    10,
  );
  if (Number.isFinite(maxPerMin) && maxPerMin > 0) {
    const ip = getClientIp(request);
    if (!checkRateLimit(ip, maxPerMin)) {
      return NextResponse.json(
        { error: "Demasiados pedidos. Tente mais tarde." },
        {
          status: 429,
          headers: { "Retry-After": "60" },
        },
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/api/:path*",
};
