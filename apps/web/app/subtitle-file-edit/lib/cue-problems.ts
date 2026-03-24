import type { CueDto } from "../types";

export const MIN_DURATION_MS = 400;
export const MAX_DURATION_MS = 12000;

export function getCueProblems(cues: CueDto[], index: number): string[] {
  const cue = cues[index];
  const nextCue = cues[index + 1];
  const problems: string[] = [];

  if (cue.startMs >= cue.endMs) {
    problems.push("startMs >= endMs");
  }

  if (!cue.text.trim()) {
    problems.push("texto vazio");
  }

  if (nextCue && cue.endMs > nextCue.startMs) {
    problems.push(`overlap com próxima cue (#${nextCue.cueIndex})`);
  }

  const duration = cue.endMs - cue.startMs;
  if (duration < MIN_DURATION_MS) {
    problems.push(`duração curta (${duration}ms)`);
  } else if (duration > MAX_DURATION_MS) {
    problems.push(`duração longa (${duration}ms)`);
  }

  return problems;
}
