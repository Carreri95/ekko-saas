function padLeft(value: number, length: number): string {
  const s = String(Math.trunc(value));
  return s.length >= length ? s : "0".repeat(length - s.length) + s;
}

/**
 * Converte milissegundos para timestamp SRT "HH:MM:SS,mmm".
 * (Duplicado temporariamente de apps/web — alinhar com format-srt legado.)
 */
export function formatSrtTimestamp(ms: number): string {
  if (!Number.isFinite(ms)) {
    throw new Error(`ms invalido: "${ms}"`);
  }
  if (ms < 0) {
    throw new Error(`ms invalido (nao pode ser negativo): "${ms}"`);
  }

  const totalMs = Math.trunc(ms);
  const mmm = totalMs % 1000;

  const totalSeconds = Math.floor(totalMs / 1000);
  const ss = totalSeconds % 60;

  const totalMinutes = Math.floor(totalSeconds / 60);
  const mm = totalMinutes % 60;

  const hh = Math.floor(totalMinutes / 60);

  return `${padLeft(hh, 2)}:${padLeft(mm, 2)}:${padLeft(ss, 2)},${padLeft(mmm, 3)}`;
}
