"use client";

import { useCallback, type RefObject } from "react";
import type WaveSurfer from "wavesurfer.js";

type BindPanSeekParams = {
  waveSurfer: WaveSurfer;
  suppressWaveformInteractionUntilRef: RefObject<number>;
  waveformEdgeDragRef: RefObject<unknown>;
  waveformMoveDragRef: RefObject<unknown>;
  waveformPanDragRef: RefObject<{
    pointerId: number;
    startClientX: number;
    startScrollPx: number;
    moved: boolean;
  } | null>;
  waveformOverviewDragRef: RefObject<{ pointerId: number } | null>;
  setIsWaveformPanning: (next: boolean) => void;
  scheduleViewportRefresh: () => void;
  seekPlaybackToTimeSec: (timeSec: number) => void;
};

function logBrowserError(context: string, error: unknown): void {
  console.error(`[subtitle-file-edit][waveform-pan-seek] ${context}`, error);
}

export function useWaveformPanSeek() {
  const bindPanSeekHandlers = useCallback((params: BindPanSeekParams) => {
    const {
      waveSurfer,
      suppressWaveformInteractionUntilRef,
      waveformEdgeDragRef,
      waveformMoveDragRef,
      waveformPanDragRef,
      waveformOverviewDragRef,
      setIsWaveformPanning,
      scheduleViewportRefresh,
      seekPlaybackToTimeSec,
    } = params;

    const panEl = waveSurfer.getWrapper();
    const wheelEl = panEl?.parentElement ?? null;
    if (!panEl) {
      return () => {};
    }

    const seekFromBackgroundClick = (clientX: number) => {
      const durationSec = waveSurfer.getDuration();
      const wrapper = waveSurfer.getWrapper();
      if (!Number.isFinite(durationSec) || durationSec <= 0 || !wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      if (rect.width <= 0) return;
      const viewportX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const totalW = Math.max(wrapper.scrollWidth, wrapper.offsetWidth);
      if (totalW <= 0) return;
      // Usa scrollLeft real do wrapper (mais confiável após drag da scrollbar nativa).
      const absoluteX = wrapper.scrollLeft + viewportX;
      const ratio = Math.max(0, Math.min(1, absoluteX / totalW));
      seekPlaybackToTimeSec(ratio * durationSec);
    };

    const wheelHandler = (e: WheelEvent) => {
      if (waveformEdgeDragRef.current || waveformMoveDragRef.current) return;
      if (waveformPanDragRef.current) return;
      if (waveformOverviewDragRef.current) return;
      const dx = e.deltaX;
      const dy = e.deltaY;
      const delta = Math.abs(dx) > Math.abs(dy) ? dx : -dy;
      if (Math.abs(delta) < 0.5) return;
      e.preventDefault();
      e.stopPropagation();
      const w = waveSurfer.getWrapper();
      if (!w) return;
      const maxS = Math.max(0, w.scrollWidth - waveSurfer.getWidth());
      if (maxS <= 0) return;
      const next = Math.max(0, Math.min(maxS, waveSurfer.getScroll() + delta * 1.15));
      waveSurfer.setScroll(next);
      // Enquanto o usuário estiver rolando manualmente, evita auto-follow agressivo.
      suppressWaveformInteractionUntilRef.current = performance.now() + 1200;
      scheduleViewportRefresh();
    };

    const panDownHandler = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (performance.now() < suppressWaveformInteractionUntilRef.current) return;
      if (waveformEdgeDragRef.current || waveformMoveDragRef.current) return;
      if (waveformOverviewDragRef.current) return;
      if (!(e.target instanceof Element)) return;
      if (
        e.target.closest(".editor-waveform-cue-handle") ||
        e.target.closest(".editor-waveform-cue-region-body") ||
        e.target.closest(".editor-waveform-cue-region")
      ) {
        return;
      }
      waveformPanDragRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startScrollPx: waveSurfer.getScroll(),
        moved: false,
      };
      suppressWaveformInteractionUntilRef.current = 0;
      setIsWaveformPanning(true);
      try {
        panEl.setPointerCapture(e.pointerId);
      } catch (error) {
        logBrowserError("setPointerCapture", error);
        /* ignore capture failures */
      }
      e.preventDefault();
    };

    const panMoveHandler = (e: PointerEvent) => {
      const pan = waveformPanDragRef.current;
      if (!pan || e.pointerId !== pan.pointerId) return;
      const wrapper = waveSurfer.getWrapper();
      const maxS = Math.max(0, wrapper.scrollWidth - waveSurfer.getWidth());
      const dx = e.clientX - pan.startClientX;
      if (!pan.moved && Math.abs(dx) > 6) {
        pan.moved = true;
      }
      const next = Math.max(0, Math.min(maxS, pan.startScrollPx - dx));
      waveSurfer.setScroll(next);
      scheduleViewportRefresh();
      e.preventDefault();
    };

    const panUpHandler = (e: PointerEvent) => {
      const pan = waveformPanDragRef.current;
      if (!pan || e.pointerId !== pan.pointerId) return;
      if (pan.moved) {
        suppressWaveformInteractionUntilRef.current = performance.now() + 1200;
      } else {
        seekFromBackgroundClick(e.clientX);
      }
      waveformPanDragRef.current = null;
      setIsWaveformPanning(false);
      try {
        panEl.releasePointerCapture(e.pointerId);
      } catch (error) {
        logBrowserError("releasePointerCapture", error);
        /* ignore release failures */
      }
    };

    if (wheelEl) {
      wheelEl.addEventListener("wheel", wheelHandler, { passive: false });
    }
    panEl.addEventListener("pointerdown", panDownHandler);
    panEl.addEventListener("pointermove", panMoveHandler);
    panEl.addEventListener("pointerup", panUpHandler);
    panEl.addEventListener("pointercancel", panUpHandler);

    return () => {
      if (wheelEl) {
        wheelEl.removeEventListener("wheel", wheelHandler);
      }
      panEl.removeEventListener("pointerdown", panDownHandler);
      panEl.removeEventListener("pointermove", panMoveHandler);
      panEl.removeEventListener("pointerup", panUpHandler);
      panEl.removeEventListener("pointercancel", panUpHandler);
    };
  }, []);

  return { bindPanSeekHandlers };
}
