import type { SubtitleCue } from "../../types/subtitle";
import { formatSrtTimestamp } from "./time";

/**
 * Formata cues em uma string `.srt`.
 * - ordena por `cueIndex`
 * - converte tempos de milissegundos para "HH:MM:SS,mmm"
 */
export function formatSrt(cues: SubtitleCue[]): string {
  const sorted = [...cues].sort((a, b) => a.cueIndex - b.cueIndex);

  const blocks = sorted.map((cue) => {
    const start = formatSrtTimestamp(cue.startMs);
    const end = formatSrtTimestamp(cue.endMs);

    const text = cue.text ?? "";
    const textLines = text.length > 0 ? text.split("\n") : [""];

    return [
      String(cue.cueIndex),
      `${start} --> ${end}`,
      ...textLines,
    ].join("\n");
  });

  if (blocks.length === 0) return "";
  return blocks.join("\n\n") + "\n";
}

