/** Limites alinhados com `apps/web/src/server/transcription/env.ts`. */
function readInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export function getMaxFileSizeBytes(): number {
  const mb = readInt("MAX_FILE_SIZE_MB", 500);
  return mb * 1024 * 1024;
}
