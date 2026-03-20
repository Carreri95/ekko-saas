import type { Episode } from "@/src/types/project";

const AUDIO_EXT_RE = /\.(wav|mp3|mp4|aac|ogg|flac|mov|mkv|m4a|webm|opus)$/i;

export function stripExt(filename: string): string {
  return filename.replace(/\.[^.]+$/, "");
}

function createEpisodeId(baseName: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `ep-${baseName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function matchEpisodes(files: FileList | File[]): Episode[] {
  const all = Array.from(files);
  const srts = all.filter((f) => f.name.toLowerCase().endsWith(".srt"));
  const audios = all.filter((f) => AUDIO_EXT_RE.test(f.name));

  const srtMap = new Map(srts.map((f) => [stripExt(f.name).toLowerCase(), f]));
  const audioMap = new Map(audios.map((f) => [stripExt(f.name).toLowerCase(), f]));

  const allNames = new Set<string>([
    ...srts.map((f) => stripExt(f.name).toLowerCase()),
    ...audios.map((f) => stripExt(f.name).toLowerCase()),
  ]);

  return Array.from(allNames)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((baseKey) => {
      const srt = srtMap.get(baseKey) ?? null;
      const audio = audioMap.get(baseKey) ?? null;
      const status = !srt ? "missing_srt" : !audio ? "missing_audio" : "pending";
      const displayName = stripExt(srt?.name ?? audio?.name ?? baseKey);
      return {
        id: createEpisodeId(baseKey),
        name: displayName,
        srtFile: srt,
        audioFile: audio,
        status,
        editedCues: null,
      } satisfies Episode;
    });
}
