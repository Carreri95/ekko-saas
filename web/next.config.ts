import type { NextConfig } from "next";

/**
 * Alinha o limite de body do Next (buffer/proxy e Server Actions) com
 * `MAX_FILE_SIZE_MB` usado em `MediaStorageService` / `src/server/transcription/env.ts`.
 * Valor por omissão 500 MB (mesmo default que `getMaxFileSizeBytes()`).
 *
 * Nota: em `next build`, o `.env` local é carregado; em CI, defina `MAX_FILE_SIZE_MB` se
 * quiser outro teto. Em self‑hosted, o reverse proxy (nginx, Caddy) também precisa de
 * `client_max_body_size` / equivalente ≥ a este valor.
 */
const maxFileMbParsed = Number.parseInt(process.env.MAX_FILE_SIZE_MB ?? "500", 10);
const maxFileMb =
  Number.isFinite(maxFileMbParsed) && maxFileMbParsed > 0 && maxFileMbParsed <= 5000
    ? maxFileMbParsed
    : 500;
const bodySize = `${maxFileMb}mb` as const;

const nextConfig: NextConfig = {
  /** Redirecionamento HTTP antes do RSC — evita 500 em dev com `redirect()` só na página. */
  async redirects() {
    return [
      {
        source: "/",
        destination: "/gerar",
        permanent: false,
      },
    ];
  },
  /** Evita que o bundler reescreva o caminho do binário (ex.: `\\ROOT\\node_modules\\...`). */
  serverExternalPackages: ["ffmpeg-static"],
  experimental: {
    /**
     * Buffer do body quando há proxy / certos caminhos internos (default ~10 MB).
     * Uploads multipart grandes (ex.: POST /api/projects/:id/media).
     */
    proxyClientMaxBodySize: bodySize,
    /**
     * Server Actions (não usadas hoje no upload, mas mantém o mesmo teto).
     */
    serverActions: {
      bodySizeLimit: bodySize,
    },
  },
};

export default nextConfig;
