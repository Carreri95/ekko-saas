"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react";
import type WaveSurfer from "wavesurfer.js";

type CueLike = {
  tempId: string;
  startMs: number;
  endMs: number;
};

type UseWaveformCueDragParams<TCue extends CueLike> = {
  waveformDurationSecRef: RefObject<number | null>;
  waveSurferRef: RefObject<WaveSurfer | null>;
  minGapMs: number;
  setSelectedCueTempId: (tempId: string) => void;
  setCueEditFocusTempId: (updater: (prev: string | null) => string | null) => void;
  suppressWaveformInteractionUntilRef: RefObject<number>;
  updateCue: (cueTempId: string, patch: Partial<Pick<TCue, "startMs" | "endMs">>) => void;
  getCueNeighborBounds: (cueTempId: string) => {
    prevEndMs: number;
    nextStartMs: number;
  };
};

function logBrowserError(context: string, error: unknown): void {
  console.error(`[subtitle-file-edit][waveform-cue-drag] ${context}`, error);
}

export function useWaveformCueDrag<TCue extends CueLike>({
  waveformDurationSecRef,
  waveSurferRef,
  minGapMs,
  setSelectedCueTempId,
  setCueEditFocusTempId,
  suppressWaveformInteractionUntilRef,
  updateCue,
  getCueNeighborBounds,
}: UseWaveformCueDragParams<TCue>) {
  const waveformEdgeDragRef = useRef<{
    tempId: string;
    edge: "start" | "end";
    startClientX: number;
    origStartMs: number;
    origEndMs: number;
  } | null>(null);

  const waveformMoveDragRef = useRef<{
    tempId: string;
    pointerId: number;
    startClientX: number;
    origStartMs: number;
    origEndMs: number;
    moved: boolean;
  } | null>(null);

  const cueDragRafRef = useRef(0);
  const cueDragPendingRef = useRef<{
    tempId: string;
    patch: Partial<Pick<TCue, "startMs" | "endMs">>;
  } | null>(null);

  const [waveformEdgeDrag, setWaveformEdgeDrag] = useState<{
    tempId: string;
    edge: "start" | "end";
  } | null>(null);
  const [waveformMoveDrag, setWaveformMoveDrag] = useState<{
    tempId: string;
  } | null>(null);

  function scheduleCueTimingPatch(
    cueTempId: string,
    patch: Partial<Pick<TCue, "startMs" | "endMs">>,
  ) {
    const pending = cueDragPendingRef.current;
    if (pending && pending.tempId === cueTempId) {
      pending.patch = { ...pending.patch, ...patch };
    } else {
      cueDragPendingRef.current = { tempId: cueTempId, patch };
    }
    if (cueDragRafRef.current) return;
    cueDragRafRef.current = requestAnimationFrame(() => {
      cueDragRafRef.current = 0;
      const next = cueDragPendingRef.current;
      cueDragPendingRef.current = null;
      if (!next) return;
      updateCue(next.tempId, next.patch);
    });
  }

  function handleWaveformEdgePointerDown(
    e: ReactPointerEvent<HTMLDivElement>,
    cue: TCue,
    edge: "start" | "end",
  ) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedCueTempId(cue.tempId);
    setCueEditFocusTempId((prev) => (prev === cue.tempId ? prev : null));
    waveformEdgeDragRef.current = {
      tempId: cue.tempId,
      edge,
      startClientX: e.clientX,
      origStartMs: cue.startMs,
      origEndMs: cue.endMs,
    };
    suppressWaveformInteractionUntilRef.current = performance.now() + 200;
    setWaveformEdgeDrag({ tempId: cue.tempId, edge });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (error) {
      logBrowserError("edge setPointerCapture", error);
    }
  }

  function handleWaveformEdgePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = waveformEdgeDragRef.current;
    if (!drag) return;
    e.preventDefault();
    const durSec = waveformDurationSecRef.current;
    if (durSec == null || durSec <= 0) return;
    const wrap = waveSurferRef.current?.getWrapper();
    const w = wrap ? Math.max(wrap.scrollWidth, wrap.offsetWidth) : 0;
    if (w <= 0) return;
    const maxMs = Math.floor(durSec * 1000);
    const deltaMs = ((e.clientX - drag.startClientX) / w) * durSec * 1000;
    const { prevEndMs, nextStartMs } = getCueNeighborBounds(drag.tempId);

    if (drag.edge === "start") {
      let nextStart = Math.round(drag.origStartMs + deltaMs);
      nextStart = Math.max(
        Math.max(0, prevEndMs),
        Math.min(nextStart, drag.origEndMs - minGapMs),
      );
      scheduleCueTimingPatch(drag.tempId, { startMs: nextStart } as Partial<Pick<TCue, "startMs" | "endMs">>);
    } else {
      let nextEnd = Math.round(drag.origEndMs + deltaMs);
      const maxEndByNeighbor = Number.isFinite(nextStartMs)
        ? nextStartMs
        : maxMs;
      nextEnd = Math.min(
        Math.min(maxMs, maxEndByNeighbor),
        Math.max(nextEnd, drag.origStartMs + minGapMs),
      );
      scheduleCueTimingPatch(drag.tempId, { endMs: nextEnd } as Partial<Pick<TCue, "startMs" | "endMs">>);
    }
  }

  function handleWaveformEdgePointerEnd(e: ReactPointerEvent<HTMLDivElement>) {
    if (!waveformEdgeDragRef.current) return;
    if (cueDragRafRef.current) {
      cancelAnimationFrame(cueDragRafRef.current);
      cueDragRafRef.current = 0;
    }
    const pending = cueDragPendingRef.current;
    cueDragPendingRef.current = null;
    if (pending) {
      updateCue(pending.tempId, pending.patch);
    }
    waveformEdgeDragRef.current = null;
    setWaveformEdgeDrag(null);
    suppressWaveformInteractionUntilRef.current = performance.now() + 120;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (error) {
      logBrowserError("edge releasePointerCapture", error);
      /* ignore */
    }
  }

  function handleWaveformMovePointerDown(e: ReactPointerEvent<HTMLElement>, cue: TCue) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedCueTempId(cue.tempId);
    setCueEditFocusTempId((prev) => (prev === cue.tempId ? prev : null));
    waveformMoveDragRef.current = {
      tempId: cue.tempId,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      origStartMs: cue.startMs,
      origEndMs: cue.endMs,
      moved: false,
    };
    suppressWaveformInteractionUntilRef.current = performance.now() + 200;
    setWaveformMoveDrag({ tempId: cue.tempId });
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (error) {
      logBrowserError("move setPointerCapture", error);
    }
  }

  function handleWaveformMovePointerMove(e: ReactPointerEvent<HTMLElement>) {
    const drag = waveformMoveDragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    e.preventDefault();
    const durSec = waveformDurationSecRef.current;
    if (durSec == null || durSec <= 0) return;
    const wrap = waveSurferRef.current?.getWrapper();
    const w = wrap ? Math.max(wrap.scrollWidth, wrap.offsetWidth) : 0;
    if (w <= 0) return;
    const maxMs = Math.floor(durSec * 1000);
    const cueDur = Math.max(1, drag.origEndMs - drag.origStartMs);
    const deltaMs = ((e.clientX - drag.startClientX) / w) * durSec * 1000;
    const { prevEndMs, nextStartMs } = getCueNeighborBounds(drag.tempId);
    if (!drag.moved && Math.abs(e.clientX - drag.startClientX) > 4) {
      drag.moved = true;
    }
    if (!drag.moved) return;
    const maxStartByNeighbor = Number.isFinite(nextStartMs)
      ? nextStartMs - cueDur
      : maxMs - cueDur;
    const nextStart = Math.max(
      Math.max(0, prevEndMs),
      Math.min(maxStartByNeighbor, Math.round(drag.origStartMs + deltaMs)),
    );
    const nextEnd = nextStart + cueDur;
    scheduleCueTimingPatch(
      drag.tempId,
      { startMs: nextStart, endMs: nextEnd } as Partial<Pick<TCue, "startMs" | "endMs">>,
    );
  }

  function handleWaveformMovePointerEnd(e: ReactPointerEvent<HTMLElement>) {
    const drag = waveformMoveDragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (cueDragRafRef.current) {
      cancelAnimationFrame(cueDragRafRef.current);
      cueDragRafRef.current = 0;
    }
    const pending = cueDragPendingRef.current;
    cueDragPendingRef.current = null;
    if (pending) {
      updateCue(pending.tempId, pending.patch);
    }
    waveformMoveDragRef.current = null;
    setWaveformMoveDrag(null);
    if (drag.moved) {
      suppressWaveformInteractionUntilRef.current = performance.now() + 120;
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (error) {
      logBrowserError("move releasePointerCapture", error);
      /* ignore */
    }
  }

  useEffect(() => {
    if (!waveformEdgeDrag && !waveformMoveDrag) {
      document.body.style.cursor = "";
      return;
    }
    document.body.style.cursor = waveformMoveDrag ? "grabbing" : "ew-resize";
    function endFromWindow() {
      if (!waveformEdgeDragRef.current && !waveformMoveDragRef.current) return;
      if (cueDragRafRef.current) {
        cancelAnimationFrame(cueDragRafRef.current);
        cueDragRafRef.current = 0;
      }
      const pending = cueDragPendingRef.current;
      cueDragPendingRef.current = null;
      if (pending) {
        updateCue(pending.tempId, pending.patch);
      }
      waveformEdgeDragRef.current = null;
      waveformMoveDragRef.current = null;
      setWaveformEdgeDrag(null);
      setWaveformMoveDrag(null);
      suppressWaveformInteractionUntilRef.current = performance.now() + 120;
    }
    window.addEventListener("pointerup", endFromWindow);
    window.addEventListener("pointercancel", endFromWindow);
    return () => {
      document.body.style.cursor = "";
      window.removeEventListener("pointerup", endFromWindow);
      window.removeEventListener("pointercancel", endFromWindow);
    };
  }, [waveformEdgeDrag, waveformMoveDrag, suppressWaveformInteractionUntilRef, updateCue]);

  useEffect(() => {
    return () => {
      if (cueDragRafRef.current) {
        cancelAnimationFrame(cueDragRafRef.current);
        cueDragRafRef.current = 0;
      }
      cueDragPendingRef.current = null;
    };
  }, []);

  return {
    waveformEdgeDragRef,
    waveformMoveDragRef,
    waveformEdgeDrag,
    waveformMoveDrag,
    handleWaveformEdgePointerDown,
    handleWaveformEdgePointerMove,
    handleWaveformEdgePointerEnd,
    handleWaveformMovePointerDown,
    handleWaveformMovePointerMove,
    handleWaveformMovePointerEnd,
  };
}
