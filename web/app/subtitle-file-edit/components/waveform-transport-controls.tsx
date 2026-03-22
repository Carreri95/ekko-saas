"use client";

import { useMemo } from "react";
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
  playbackRate,
  speedSteps,
  onPlaybackRateChange,
}: WaveformTransportControlsProps) {
  const progress =
    durationMs && durationMs > 0
      ? Math.min(1, currentPlaybackMs / durationMs)
      : 0;
  const progressPct = (progress * 100).toFixed(4);
  const remainingMs =
    durationMs != null ? Math.max(0, durationMs - currentPlaybackMs) : null;

  const playbackRateForSelect = useMemo(
    () =>
      speedSteps.find((r) => Math.abs(r - playbackRate) < 1e-4) ??
      speedSteps.reduce((a, b) =>
        Math.abs(b - playbackRate) < Math.abs(a - playbackRate) ? b : a,
      ),
    [playbackRate, speedSteps],
  );

  return (
    <div className="editor-transport-root flex w-full flex-col">
      <div className="relative h-[2px] w-full shrink-0 overflow-hidden bg-[var(--editor-transport-progress-track)]">
        <div
          className="absolute left-0 top-0 h-full bg-[var(--editor-transport-progress-fill)]"
          style={{ width: `${progressPct}%`, transition: "none" }}
        />
        <div
          className="absolute top-0 h-full w-[1.5px] bg-[var(--editor-transport-playhead)]"
          style={{ left: `calc(${progressPct}% - 0.75px)`, transition: "none" }}
        />
      </div>

      <div className="flex h-[40px] w-full shrink-0 items-center gap-[6px] border-t border-[var(--editor-transport-row-border)] bg-[var(--editor-transport-row-bg)] px-3">
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onReset}
          className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[5px] border border-[#2e2e2e] bg-transparent text-[#555] transition-colors hover:border-[#444] hover:text-[#909090] active:scale-95"
          title="Voltar ao início"
        >
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <rect x="1" y="1" width="1.5" height="8" rx="0.5" fill="currentColor" />
            <path d="M3.5 5L9 1.5V8.5L3.5 5Z" fill="currentColor" />
          </svg>
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onPlay}
          className="flex h-[26px] w-[28px] shrink-0 items-center justify-center rounded-[5px] bg-[var(--editor-transport-play)] text-white transition-colors hover:bg-[var(--editor-transport-play-hover)] active:scale-95"
          title="Play (Espaço)"
        >
          <svg width="9" height="11" viewBox="0 0 11 12" fill="none">
            <path d="M2 1L9.5 6L2 11V1Z" fill="currentColor" />
          </svg>
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onPause}
          className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[5px] border border-[#2e2e2e] bg-transparent text-[#555] transition-colors hover:border-[#444] hover:text-[#909090] active:scale-95"
          title="Pausar (Espaço)"
        >
          <svg width="9" height="11" viewBox="0 0 10 12" fill="none">
            <rect x="1" y="1" width="3" height="10" rx="0.75" fill="currentColor" />
            <rect x="6" y="1" width="3" height="10" rx="0.75" fill="currentColor" />
          </svg>
        </button>

        <div className="mx-[4px] h-[16px] w-px shrink-0 bg-[#2e2e2e]" aria-hidden />

        <div className="inline-flex min-w-0 shrink-0 items-baseline gap-0.5">
          <span className="font-mono text-[13px] leading-none tabular-nums tracking-tight text-[#e8e8e8]">
            {formatTime(currentPlaybackMs)}
          </span>
          {durationMs != null && (
            <span className="font-mono text-[11px] leading-none tabular-nums text-[#444]">
              / {formatTime(durationMs)}
            </span>
          )}
        </div>

        <select
          value={playbackRateForSelect}
          onChange={(e) =>
            onPlaybackRateChange(Number.parseFloat(e.target.value))
          }
          className="editor-transport-rate-select ml-[6px] w-fit shrink-0 cursor-pointer appearance-none rounded-[4px] border border-[#2e2e2e] bg-transparent px-[6px] py-0 font-mono text-[11px] leading-none text-[#555] outline-none hover:border-[#444] hover:text-[#909090]"
          title="Velocidade de reprodução"
          aria-label="Velocidade de reprodução"
        >
          {speedSteps.map((rate) => (
            <option key={rate} value={rate}>
              {rate}×
            </option>
          ))}
        </select>

        <div className="flex-1" />

        {remainingMs != null && remainingMs > 100 && (
          <span className="shrink-0 font-mono text-[11px] tabular-nums text-[#444]">
            -{formatTime(remainingMs)}
          </span>
        )}
      </div>
    </div>
  );
}
