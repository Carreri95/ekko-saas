"use client";

import type { PointerEvent as ReactPointerEvent } from "react";

type WaveformViewport = {
  scroll: number;
  maxScroll: number;
  viewW: number;
  totalW: number;
} | null;

type WaveformOverviewProps = {
  viewport: WaveformViewport;
  thumbLeftPct: number;
  thumbWidthPct: number;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
};

export function WaveformOverview({
  viewport,
  thumbLeftPct,
  thumbWidthPct,
  onPointerDown,
}: WaveformOverviewProps) {
  if (!viewport || viewport.totalW <= 0) return null;
  const canScroll = viewport.maxScroll > 0;

  return (
    <div
      className="editor-waveform-overview mt-1.5 shrink-0"
      role="region"
      aria-label="Vista geral da timeline"
    >
      <div
        className={`editor-waveform-overview-track relative h-[16px] w-full touch-none rounded-sm border border-zinc-700/60 bg-[#0e0e0e] ${
          canScroll ? "cursor-grab active:cursor-grabbing" : "cursor-default opacity-40"
        }`}
        onPointerDown={onPointerDown}
        role="slider"
        tabIndex={0}
        aria-disabled={!canScroll}
        aria-label="Deslocar a área visível da forma de onda"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(
          viewport.maxScroll > 0 ? (viewport.scroll / viewport.maxScroll) * 100 : 0,
        )}
      >
        <div
          className="editor-waveform-overview-thumb pointer-events-none absolute inset-y-[2px] rounded-sm border border-white/25 bg-white/10"
          style={{
            left: `${thumbLeftPct}%`,
            width: `${thumbWidthPct}%`,
          }}
        />
      </div>
    </div>
  );
}
