import type { RawTranscript } from "./types.js";

/**
 * Converte o JSON guardado em `TranscriptionJob.rawResponse` (ex.: verbose_json OpenAI
 * ou payload do MockAdapter) para `RawTranscript`, para reprocessar só a normalização.
 */
export function parseStoredRawResponseToTranscript(raw: unknown): RawTranscript {
  if (raw === null || typeof raw !== "object") {
    throw new Error("rawResponse invalido ou vazio");
  }
  const o = raw as Record<string, unknown>;
  const segsRaw = o.segments;
  if (!Array.isArray(segsRaw)) {
    throw new Error("rawResponse sem array segments");
  }

  const segments = segsRaw.map((s, i) => {
    if (!s || typeof s !== "object") {
      throw new Error(`Segmento ${i} invalido`);
    }
    const seg = s as Record<string, unknown>;
    const start = Number(seg.start);
    const end = Number(seg.end);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      throw new Error(`Segmento ${i}: start/end invalidos`);
    }
    return {
      start,
      end,
      text: String(seg.text ?? ""),
    };
  });

  const durationSec =
    typeof o.duration === "number" && Number.isFinite(o.duration)
      ? o.duration
      : segments.length > 0
        ? Math.max(0, ...segments.map((s) => s.end))
        : 0;

  const language =
    typeof o.language === "string" && o.language.trim() !== "" ? o.language : "unknown";

  return {
    segments,
    language,
    durationSec,
  };
}
