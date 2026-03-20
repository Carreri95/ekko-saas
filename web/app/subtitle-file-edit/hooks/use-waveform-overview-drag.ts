"use client";

import { useCallback } from "react";
import type { MutableRefObject, PointerEvent as ReactPointerEvent } from "react";
import type WaveSurfer from "wavesurfer.js";

type UseWaveformOverviewDragParams = {
  waveSurferRef: MutableRefObject<WaveSurfer | null>;
  waveformViewport: {
    scroll: number;
    maxScroll: number;
    viewW: number;
    totalW: number;
  } | null;
  waveformEdgeDragRef: MutableRefObject<unknown>;
  waveformMoveDragRef: MutableRefObject<unknown>;
  waveformPanDragRef: MutableRefObject<unknown>;
  waveformOverviewDragRef: MutableRefObject<{ pointerId: number } | null>;
  logBrowserError: (context: string, error: unknown) => void;
};

export function useWaveformOverviewDrag({
  waveSurferRef,
  waveformViewport,
  waveformEdgeDragRef,
  waveformMoveDragRef,
  waveformPanDragRef,
  waveformOverviewDragRef,
  logBrowserError,
}: UseWaveformOverviewDragParams) {
  const handleWaveformOverviewPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      if (waveformEdgeDragRef.current || waveformMoveDragRef.current) return;
      if (waveformPanDragRef.current || waveformOverviewDragRef.current) return;
      const ws = waveSurferRef.current;
      const vp = waveformViewport;
      if (!ws || !vp || vp.maxScroll <= 0) return;
      const track = e.currentTarget;
      waveformOverviewDragRef.current = { pointerId: e.pointerId };
      try {
        track.setPointerCapture(e.pointerId);
      } catch (error) {
        logBrowserError("overview pointer capture", error);
        /* ignore capture failures */
      }
      e.preventDefault();
      e.stopPropagation();
      const apply = (clientX: number) => {
        const rect = track.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        ws.setScroll(ratio * vp.maxScroll);
      };
      apply(e.clientX);
      const onMove = (ev: PointerEvent) => {
        const drag = waveformOverviewDragRef.current;
        if (!drag || ev.pointerId !== drag.pointerId) return;
        apply(ev.clientX);
      };
      const onUp = (ev: PointerEvent) => {
        const drag = waveformOverviewDragRef.current;
        if (!drag || ev.pointerId !== drag.pointerId) return;
        waveformOverviewDragRef.current = null;
        try {
          track.releasePointerCapture(ev.pointerId);
        } catch (error) {
          logBrowserError("overview pointer release", error);
          /* ignore release failures */
        }
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [
      waveSurferRef,
      waveformViewport,
      waveformEdgeDragRef,
      waveformMoveDragRef,
      waveformPanDragRef,
      waveformOverviewDragRef,
      logBrowserError,
    ],
  );

  return { handleWaveformOverviewPointerDown };
}
