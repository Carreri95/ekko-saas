/** Formato legível para revisão (próximo ao estilo tempo de legenda). */
export function formatPlaybackTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const frac = ms % 1000;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)},${pad(frac, 3)}`;
  return `${pad(m)}:${pad(s)},${pad(frac, 3)}`;
}
