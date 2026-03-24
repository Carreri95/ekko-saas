import type { CueDto } from "../types";

export function createTempId(): string {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function reindexCues(cues: CueDto[]): CueDto[] {
  return cues.map((cue, index) => ({ ...cue, cueIndex: index + 1 }));
}

export function toSaveCuePayload(cues: CueDto[]) {
  return cues.map((cue) => ({
    id: cue.id ?? undefined,
    startMs: cue.startMs,
    endMs: cue.endMs,
    text: cue.text,
  }));
}

export function getSaveCueHash(cues: CueDto[]): string {
  return JSON.stringify(toSaveCuePayload(cues));
}

export function validateCuesForSave(cues: CueDto[]): string | null {
  for (const cue of cues) {
    if (!Number.isFinite(cue.startMs) || !Number.isFinite(cue.endMs)) {
      return `Cue ${cue.cueIndex}: startMs/endMs inválidos`;
    }
    if (cue.startMs >= cue.endMs) {
      return `Cue ${cue.cueIndex}: startMs deve ser menor que endMs`;
    }
  }
  for (let i = 0; i < cues.length - 1; i += 1) {
    if (cues[i].endMs > cues[i + 1].startMs) {
      return `Cue ${cues[i].cueIndex} sobrepõe cue ${cues[i + 1].cueIndex}. Ajuste os tempos antes de salvar.`;
    }
  }
  return null;
}

/** Máximo de caracteres por linha (layout) — usado no painel; independente do CPS. */
export const CPL_MAX_CHARS = 42;

/**
 * Caracteres para cálculo de CPS: igual ao painel do editor — remove só quebras de linha,
 * mantém espaços (mede velocidade de leitura do texto “achatado”).
 */
export function charCountForCps(text: string): number {
  return text.replace(/\r\n/g, "\n").replace(/\n/g, "").length;
}

/**
 * CPS = caracteres (acima) / duração. Limiares ~prática EBU/legendagem (velocidade), não
 * são o mesmo que CPL: o “42” limita caracteres por linha; ~21 CPS equivale, em ordem de
 * grandeza, a ler uma linha cheia (42) em ~2 s.
 */
export const CPS_WARN_ABOVE = 17;
export const CPS_CRIT_ABOVE = 21;

export function computeCueCps(
  text: string,
  startMs: number,
  endMs: number,
): number {
  const dur = Math.max(0.001, (endMs - startMs) / 1000);
  return charCountForCps(text) / dur;
}

/**
 * Insere uma quebra de linha próxima ao meio (mesma ideia do botão "Auto br" no editor).
 * Textos muito curtos não são alterados.
 */
export function autoBrText(text: string): string {
  if (!text || text.length < 10) return text;
  const flat = text.trim();
  if (!flat) return text;
  const mid = Math.floor(flat.length / 2);
  let splitAt = -1;
  for (let i = 0; i <= 15; i++) {
    const left = mid - i;
    const right = mid + i;
    if (left >= 0 && flat[left] === " ") {
      splitAt = left;
      break;
    }
    if (right < flat.length && flat[right] === " ") {
      splitAt = right;
      break;
    }
  }
  if (splitAt < 0) return flat;
  return `${flat.slice(0, splitAt)}\n${flat.slice(splitAt + 1)}`;
}

/**
 * Divide o texto de uma cue em duas partes proporcionalmente ao instante do split no tempo.
 * Usa palavras após flatten (whitespace); com 1 palavra só, tudo fica na primeira parte.
 */
export function splitCueTextAtTemporalRatio(
  cue: Pick<CueDto, "startMs" | "endMs" | "text">,
  splitMs: number,
): { textA: string; textB: string } {
  const raw = cue.text.trim();
  if (!raw) return { textA: "", textB: "" };
  const words = raw.split(/\s+/);
  if (words.length <= 1) return { textA: raw, textB: "" };

  const span = cue.endMs - cue.startMs;
  const ratio = span > 0 ? (splitMs - cue.startMs) / span : 0;
  const splitWordIndex = Math.max(
    1,
    Math.min(words.length - 1, Math.round(ratio * words.length)),
  );
  const textA = words.slice(0, splitWordIndex).join(" ");
  const textB = words.slice(splitWordIndex).join(" ");
  return { textA, textB };
}

export function normalizeCueCollisions(cues: CueDto[], minGapMs: number): CueDto[] {
  if (!cues.length) return cues;
  const ordered = [...cues].sort((a, b) => a.startMs - b.startMs);
  const normalized = ordered.map((cue) => ({ ...cue }));
  for (let i = 0; i < normalized.length; i += 1) {
    const prevEnd = i > 0 ? normalized[i - 1].endMs : 0;
    const startMs = Math.max(0, normalized[i].startMs, prevEnd);
    let endMs = Math.max(startMs + minGapMs, normalized[i].endMs);
    if (i < normalized.length - 1) {
      const nextOrigStart = Math.max(startMs + minGapMs, normalized[i + 1].startMs);
      endMs = Math.min(endMs, nextOrigStart);
      if (endMs - startMs < minGapMs) {
        endMs = startMs + minGapMs;
      }
    }
    normalized[i] = {
      ...normalized[i],
      startMs,
      endMs,
    };
  }
  return reindexCues(normalized);
}
