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

export function getMaxTranscriptionAttempts(): number {
  const n = readInt("MAX_TRANSCRIPTION_ATTEMPTS", 3);
  return Math.max(1, n);
}

export function getOpenAIApiKey(): string | undefined {
  const k = process.env.OPENAI_API_KEY;
  return k && k.trim() !== "" ? k.trim() : undefined;
}
