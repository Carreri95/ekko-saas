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
