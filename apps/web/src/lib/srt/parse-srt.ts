import type { SubtitleCue } from "../../types/subtitle";
import { parseSrtTimestamp } from "./time";

function parseIndexLine(line: string): number {
  const n = Number.parseInt(line.trim(), 10);
  if (!Number.isFinite(n)) {
    throw new Error(`Indice SRT invalido: "${line}"`);
  }
  return n;
}

/**
 * Faz parsing de um arquivo `.srt` em uma lista de cues.
 * - separa blocos por linhas em branco
 * - valida indice e intervalo de tempo
 * - converte "HH:MM:SS,mmm" para milissegundos
 */
export function parseSrt(srtContent: string): SubtitleCue[] {
  const normalized = srtContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!normalized) return [];

  const blocks = normalized.split(/\n\s*\n+/g).map((b) => b.trim());
  const cues: SubtitleCue[] = [];

  for (const block of blocks) {
    const lines = block.split("\n").map((l) => l.trimEnd());

    if (lines.length < 2) {
      throw new Error(`Bloco SRT invalido: "${block}"`);
    }

    const cueIndex = parseIndexLine(lines[0]);
    const timeLine = lines[1].trim();

    const timeMatch = /^(.+?)\s*-->\s*(.+?)$/.exec(timeLine);
    if (!timeMatch) {
      throw new Error(`Linha de tempo invalida: "${timeLine}"`);
    }

    const startMs = parseSrtTimestamp(timeMatch[1]);
    const endMs = parseSrtTimestamp(timeMatch[2]);

    if (startMs >= endMs) {
      throw new Error(
        `Intervalo de tempo invalido no cue ${cueIndex}: ${startMs} >= ${endMs}`
      );
    }

    const textLines = lines.slice(2);
    const text = textLines.map((l) => l.trimEnd()).join("\n");

    cues.push({ cueIndex, startMs, endMs, text });
  }

  return cues;
}

