import { parseBuffer } from "music-metadata";

/**
 * Duração em ms a partir do buffer (sem ffmpeg). Falha silenciosamente → null.
 * Suporta mp3, wav, m4a, webm, etc., conforme `music-metadata`.
 */
export async function getAudioDurationMsFromBuffer(
  buffer: Buffer,
  mimeType: string,
): Promise<number | null> {
  const mime = mimeType.split(";")[0]?.trim() || "application/octet-stream";
  try {
    const meta = await parseBuffer(buffer, { mimeType: mime }, { duration: true });
    const sec = meta.format.duration;
    if (typeof sec !== "number" || !Number.isFinite(sec) || sec <= 0) {
      return null;
    }
    return Math.round(sec * 1000);
  } catch {
    return null;
  }
}
