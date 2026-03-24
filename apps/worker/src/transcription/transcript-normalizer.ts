import type { NormalizedCue, RawTranscript } from "./types.js";

const NOISE_LINE =
  /^\s*(\[music\]|\[Music\]|\(music\)|\(inaudível\)|\(inaudivel\)|\(inaudible\))\s*$/i;

/** Remove artefatos comuns do Whisper e normaliza espaços. */
export function cleanText(text: string): string {
  let t = text.trim();
  t = t.replace(/\s+/g, " ");
  if (NOISE_LINE.test(t)) {
    return "";
  }
  t = t.replace(/\s*(\[Music\]|\[music\]|\(inaudível\)|\(inaudivel\)|\(inaudible\))\s*/gi, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

function isEmptyOrPunctuationOnly(text: string): boolean {
  /** Sem letras ou dígitos (inclui faixa latina estendida comum) — evita regex de pontuação frágil. */
  return !/[A-Za-z0-9\u00C0-\u024F]/.test(text);
}

/** Converte transcript bruto em cues internas (função pura). */
export function normalizeTranscript(raw: RawTranscript): NormalizedCue[] {
  const out: NormalizedCue[] = [];
  let idx = 0;
  for (const seg of raw.segments) {
    const text = cleanText(seg.text);
    if (!text || isEmptyOrPunctuationOnly(text)) continue;

    const startMs = Math.round(seg.start * 1000);
    let endMs = Math.round(seg.end * 1000);
    if (endMs <= startMs) {
      endMs = startMs + 1;
    }

    idx += 1;
    out.push({
      cueIndex: idx,
      startMs,
      endMs,
      text,
    });
  }
  return out;
}
