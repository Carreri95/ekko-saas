"use client";

import { useMemo } from "react";
import type { WaveformTimeRulerProps, WaveformTimeRulerTick } from "../types";

function chooseStep(visibleDur: number): number {
  if (visibleDur < 2) return 0.25;
  if (visibleDur < 5) return 0.5;
  if (visibleDur > 120) return 10;
  if (visibleDur > 60) return 5;
  if (visibleDur > 20) return 2;
  return 1;
}

function formatRulerLabel(seconds: number): string {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  return seconds.toFixed(1);
}

export function WaveformTimeRuler({ viewport, durationSec }: WaveformTimeRulerProps) {
  const ticks = useMemo<WaveformTimeRulerTick[]>(() => {
    if (!viewport || !durationSec || durationSec <= 0 || viewport.totalW <= 0) return [];
    const startT = (viewport.scroll / viewport.totalW) * durationSec;
    const visibleDur = (viewport.viewW / viewport.totalW) * durationSec;
    if (visibleDur <= 0) return [];
    const endT = Math.min(durationSec, startT + visibleDur);
    const step = chooseStep(visibleDur);
    const list: WaveformTimeRulerTick[] = [];
    const firstIndex = Math.ceil(startT / step);
    let lastLeftPx = Number.NEGATIVE_INFINITY;
    for (let idx = firstIndex; ; idx += 1) {
      const t = idx * step;
      if (t > endT + step * 0.5) break;
      const rawX = ((t - startT) / visibleDur) * viewport.viewW;
      const leftPx = Math.round(rawX) + 0.5;
      if (leftPx < 0 || leftPx > viewport.viewW) continue;
      if (Math.abs(leftPx - lastLeftPx) < 1) continue;
      lastLeftPx = leftPx;
      const isMajor = Math.abs(t - Math.round(t)) < 0.001;
      list.push({ leftPx, isMajor, label: isMajor ? formatRulerLabel(t) : "" });
    }
    return list;
  }, [viewport, durationSec]);

  if (!ticks.length) return null;

  return (
    <div className="relative h-[24px] w-full shrink-0 border-b border-[var(--border)] bg-[var(--bg-page)]">
      {ticks.map((tick, idx) => (
        <div
          key={`${tick.leftPx}-${idx}`}
          className="pointer-events-none absolute bottom-0 top-0"
          style={{ left: `${tick.leftPx}px` }}
          aria-hidden
        >
          {/* Tick mark */}
          <div
            className={`absolute bottom-0 w-px ${
              tick.isMajor
                ? "h-[8px] bg-[color-mix(in_srgb,var(--text-muted)_70%,transparent)]"
                : "h-[4px] bg-[color-mix(in_srgb,var(--border-mid)_60%,transparent)]"
            }`}
          />
          {/* Label — sits above the tick */}
          {tick.isMajor && tick.label ? (
            <span className="absolute bottom-[10px] left-1 font-mono text-[9px] leading-none tabular-nums text-[color-mix(in_srgb,var(--text-muted)_80%,transparent)]">
              {tick.label}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
