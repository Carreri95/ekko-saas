/** Alinhado ao `accept` do input na página Gerar. */
export const AUDIO_ACCEPT_ATTR = ".mp3,.wav,.m4a,.webm,audio/*";

export function filterAudioFiles(files: readonly File[]): File[] {
  return files.filter((f) => {
    const name = f.name.toLowerCase();
    if (/\.(mp3|wav|m4a|webm|ogg|flac|aac|opus)$/i.test(name)) return true;
    if (f.type.startsWith("audio/")) return true;
    return false;
  });
}
