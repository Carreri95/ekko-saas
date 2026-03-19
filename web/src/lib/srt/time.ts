function padLeft(value: number, length: number): string {
  const s = String(Math.trunc(value));
  return s.length >= length ? s : "0".repeat(length - s.length) + s;
}

/**
 * Converte um timestamp SRT "HH:MM:SS,mmm" (ou "HH:MM:SS.mmm") para milissegundos.
 */
export function parseSrtTimestamp(timestamp: string): number {
  const normalized = timestamp.trim().replace(".", ",");

  const match = /^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/.exec(normalized);
  if (!match) {
    throw new Error(`Timestamp SRT invalido: "${timestamp}"`);
  }

  const hh = Number(match[1]);
  const mm = Number(match[2]);
  const ss = Number(match[3]);
  const mmm = Number(match[4]);

  if (mm > 59 || ss > 59) {
    throw new Error(`Timestamp SRT invalido: "${timestamp}"`);
  }

  return ((hh * 60 + mm) * 60 + ss) * 1000 + mmm;
}

/**
 * Converte milissegundos para timestamp SRT "HH:MM:SS,mmm".
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

