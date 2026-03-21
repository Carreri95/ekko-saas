import type { BatchJobRow } from "./types";

export function formatUtcTimestamp(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

export function formatEngineLabel(engine: string): string {
  if (engine === "OPENAI_WHISPER") return "OpenAI Whisper API";
  if (engine === "MOCK") return "Mock (sem API)";
  return engine;
}

export function doneDurationSeconds(job: BatchJobRow): number | null {
  if (job.status !== "DONE" || !job.startedAt || !job.completedAt) return null;
  const a = new Date(job.startedAt).getTime();
  const b = new Date(job.completedAt).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.round((b - a) / 1000));
}
