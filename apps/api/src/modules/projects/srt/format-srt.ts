import { formatSrtTimestamp } from "./time.js";

type CueLike = {
  cueIndex: number;
  startMs: number;
  endMs: number;
  text: string | null;
};

/**
 * Formata cues em uma string `.srt`.
 * (Duplicado temporariamente de apps/web — alinhar com format-srt legado.)
 */
export function formatSrt(cues: CueLike[]): string {
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
