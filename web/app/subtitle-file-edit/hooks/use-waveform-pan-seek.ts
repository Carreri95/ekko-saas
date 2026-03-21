"use client";

import { useCallback } from "react";
import type { BindPanSeekParams } from "../types";

/**
 * Scroll horizontal da waveform via roda do rato (não pan por arrastar — ver use-waveform-cue-create).
 */
export function useWaveformPanSeek() {
  const bindPanSeekHandlers = useCallback((params: BindPanSeekParams) => {
    const {
      waveSurfer,
      suppressWaveformInteractionUntilRef,
      suppressPlayheadFollowUntilRef,
      waveformEdgeDragRef,
      waveformMoveDragRef,
      waveformOverviewDragRef,
      scheduleViewportRefresh,
    } = params;

    const panEl = waveSurfer.getWrapper();
    const wheelEl = panEl?.parentElement ?? null;
    if (!panEl) {
      return () => {};
    }

    /**
     * Suprime cliques “fantasma” na área vazia da waveform (ex.: após drag).
     * Cliques em cues nunca são bloqueados — seek intencional do utilizador.
     */
    const clickCaptureSuppressHandler = (e: MouseEvent) => {
      if (
        e.target instanceof Element &&
        e.target.closest('[data-editor-cue-sync="region"]')
      ) {
        return;
      }
      if (performance.now() < suppressWaveformInteractionUntilRef.current) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    const wheelHandler = (e: WheelEvent) => {
      if (waveformEdgeDragRef.current || waveformMoveDragRef.current) return;
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
      suppressPlayheadFollowUntilRef.current = performance.now() + 3200;
      scheduleViewportRefresh();
    };

    if (wheelEl) {
      wheelEl.addEventListener("wheel", wheelHandler, { passive: false });
      wheelEl.addEventListener("click", clickCaptureSuppressHandler, true);
    }

    return () => {
      if (wheelEl) {
        wheelEl.removeEventListener("wheel", wheelHandler);
        wheelEl.removeEventListener("click", clickCaptureSuppressHandler, true);
      }
    };
  }, []);

  return { bindPanSeekHandlers };
}
