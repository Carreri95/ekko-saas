"use client";

import type { WaveformTransportControlsProps } from "../types";

function formatTime(ms: number): string {
  const totalSec = Math.max(0, ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = (totalSec % 60).toFixed(3).padStart(6, "0");
  return `${String(m).padStart(2, "0")}:${s}`;
}

export function WaveformTransportControls({
  onPlay,
  onPause,
  onReset,
  currentPlaybackMs,
  durationMs,
}: WaveformTransportControlsProps) {
  const progress =
    durationMs && durationMs > 0
      ? Math.min(1, currentPlaybackMs / durationMs)
      : 0;
  const progressPct = (progress * 100).toFixed(4);
  const remainingMs =
    durationMs != null ? Math.max(0, durationMs - currentPlaybackMs) : null;

  return (
    <div className="flex h-full w-full flex-col">
      {/* Controls row */}
      <div className="flex h-9 shrink-0 items-center gap-2 bg-zinc-950 px-3">
        {/* Reset */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onReset}
          className="flex h-6 w-6 items-center justify-center rounded-sm border border-zinc-800 bg-zinc-900 text-zinc-500 transition-colors hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-200 active:scale-95"
          title="Voltar ao início"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <rect x="1" y="1" width="1.5" height="8" rx="0.5" fill="currentColor" />
            <path d="M3.5 5L9 1.5V8.5L3.5 5Z" fill="currentColor" />
          </svg>
        </button>

        {/* Play — square blue */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onPlay}
          className="flex h-7 w-7 items-center justify-center rounded-sm bg-blue-600 text-white transition-all hover:bg-blue-500 active:scale-95 active:bg-blue-700"
          title="Play (Espaço)"
        >
          <svg width="11" height="12" viewBox="0 0 11 12" fill="none">
            <path d="M2 1L9.5 6L2 11V1Z" fill="currentColor" />
          </svg>
        </button>

        {/* Pause — square outlined */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onPause}
          className="flex h-7 w-7 items-center justify-center rounded-sm border border-zinc-700/80 bg-zinc-900 text-zinc-400 transition-colors hover:border-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 active:scale-95"
          title="Pausar (Espaço)"
        >
          <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
            <rect x="1" y="1" width="3" height="10" rx="0.75" fill="currentColor" />
            <rect x="6" y="1" width="3" height="10" rx="0.75" fill="currentColor" />
          </svg>
        </button>

        <div className="mx-1 h-4 w-px bg-zinc-800" />

        {/* Timecode */}
        <span className="font-mono text-[13px] tabular-nums tracking-tight text-zinc-100">
          {formatTime(currentPlaybackMs)}
        </span>

        {durationMs != null && (
          <span className="font-mono text-[11px] tabular-nums text-zinc-600">
            / {formatTime(durationMs)}
          </span>
        )}

        <div className="flex-1" />

        {remainingMs != null && remainingMs > 100 && (
          <span className="font-mono text-[11px] tabular-nums text-zinc-600">
            -{formatTime(remainingMs)}
          </span>
        )}
      </div>

      {/* Progress strip — thin bar showing exact playhead position */}
      <div className="relative h-[3px] w-full shrink-0 overflow-hidden bg-zinc-900">
        <div
          className="absolute left-0 top-0 h-full bg-blue-500/60"
          style={{ width: `${progressPct}%`, transition: "none" }}
        />
        <div
          className="absolute top-0 h-full w-[2px] bg-amber-400"
          style={{ left: `calc(${progressPct}% - 1px)`, transition: "none" }}
        />
      </div>
    </div>
  );
}

/*
 * INTEGRAÇÃO em timeline-dock.tsx
 * ================================
 * 1. Adicionar props ao TimelineDockProps:
 *      waveformDurationSec: number | null;  (já existe)
 *
 * 2. Passar para o componente:
 *      <WaveformTransportControls
 *        onPlay={onPlayMedia}
 *        onPause={onPauseMedia}
 *        onReset={onResetMediaToStart}
 *        currentPlaybackMs={currentPlaybackMs}
 *        durationMs={waveformDurationSec != null ? waveformDurationSec * 1000 : null}
 *      />
 *
 * 3. Aumentar altura do container de h-9 para h-[48px]:
 *      <div className="h-[48px] shrink-0 border-t border-zinc-800/60">
 *        <WaveformTransportControls ... />
 *      </div>
 *
 * 4. O timecode grande na toolbar acima (00:22,991 em font-mono text-[20px])
 *    pode ser removido pois agora fica nos controles de transporte.
 */
