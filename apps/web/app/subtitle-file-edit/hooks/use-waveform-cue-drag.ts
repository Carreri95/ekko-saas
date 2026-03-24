"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { CueWaveformDragCue, UseWaveformCueDragParams } from "../types";

function logBrowserError(context: string, error: unknown): void {
  console.error(`[subtitle-file-edit][waveform-cue-drag] ${context}`, error);
}

export function useWaveformCueDrag<TCue extends CueWaveformDragCue>({
  waveformDurationSecRef,
  waveSurferRef,
  minGapMs,
  setSelectedCueTempId,
  setCueEditFocusTempId,
  suppressWaveformInteractionUntilRef,
  updateCue,
  getCueNeighborBounds,
  takeCuesSnapshotForUndo,
  commitTimingUndo,
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

  const edgeUndoSnapshotRef = useRef<TCue[] | null>(null);
  const edgeUndoCueIndexRef = useRef(0);
  const moveUndoSnapshotRef = useRef<TCue[] | null>(null);
  const moveUndoCueIndexRef = useRef(0);
  /** Acumula o último patch de tempos durante o drag (sobrevive quando o rAF já limpou `pending`). */
  const edgeDragLastPatchRef = useRef<Partial<Pick<TCue, "startMs" | "endMs">>>({});
  const moveDragLastPatchRef = useRef<Partial<Pick<TCue, "startMs" | "endMs">>>({});

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
    const edgeD = waveformEdgeDragRef.current;
    if (edgeD && edgeD.tempId === cueTempId) {
      edgeDragLastPatchRef.current = { ...edgeDragLastPatchRef.current, ...patch };
    }
    const moveD = waveformMoveDragRef.current;
    if (moveD && moveD.tempId === cueTempId) {
      moveDragLastPatchRef.current = { ...moveDragLastPatchRef.current, ...patch };
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
    if (takeCuesSnapshotForUndo && commitTimingUndo) {
      edgeUndoSnapshotRef.current = takeCuesSnapshotForUndo().map((c) => ({ ...c }));
      edgeUndoCueIndexRef.current = cue.cueIndex;
      edgeDragLastPatchRef.current = {};
    } else {
      edgeUndoSnapshotRef.current = null;
    }
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
    const drag = waveformEdgeDragRef.current;
    if (!drag) return;
    if (cueDragRafRef.current) {
      cancelAnimationFrame(cueDragRafRef.current);
      cueDragRafRef.current = 0;
    }
    const pending = cueDragPendingRef.current;
    cueDragPendingRef.current = null;
    if (pending) {
      updateCue(pending.tempId, pending.patch);
    }
    const acc = edgeDragLastPatchRef.current;
    edgeDragLastPatchRef.current = {};
    const snap = edgeUndoSnapshotRef.current;
    edgeUndoSnapshotRef.current = null;
    if (snap && commitTimingUndo && takeCuesSnapshotForUndo) {
      let finalStart = drag.origStartMs;
      let finalEnd = drag.origEndMs;
      if (acc.startMs != null) finalStart = acc.startMs as number;
      if (acc.endMs != null) finalEnd = acc.endMs as number;
      const changed =
        finalStart !== drag.origStartMs || finalEnd !== drag.origEndMs;
      if (changed) {
        commitTimingUndo(
          snap,
          `Redimensionar cue #${edgeUndoCueIndexRef.current}`,
        );
      }
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
    if (takeCuesSnapshotForUndo && commitTimingUndo) {
      moveUndoSnapshotRef.current = takeCuesSnapshotForUndo().map((c) => ({ ...c }));
      moveUndoCueIndexRef.current = cue.cueIndex;
      moveDragLastPatchRef.current = {};
    } else {
      moveUndoSnapshotRef.current = null;
    }
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
    if (!drag.moved && Math.abs(e.clientX - drag.startClientX) > 3) {
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
    const didMove = drag.moved;
    if (cueDragRafRef.current) {
      cancelAnimationFrame(cueDragRafRef.current);
      cueDragRafRef.current = 0;
    }
    const pending = cueDragPendingRef.current;
    cueDragPendingRef.current = null;
    if (pending) {
      updateCue(pending.tempId, pending.patch);
    }
    const mAcc = moveDragLastPatchRef.current;
    moveDragLastPatchRef.current = {};
    const moveSnap = moveUndoSnapshotRef.current;
    moveUndoSnapshotRef.current = null;
    if (
      moveSnap &&
      commitTimingUndo &&
      takeCuesSnapshotForUndo &&
      didMove
    ) {
      const fs =
        mAcc.startMs != null ? (mAcc.startMs as number) : drag.origStartMs;
      const fe = mAcc.endMs != null ? (mAcc.endMs as number) : drag.origEndMs;
      const changed = fs !== drag.origStartMs || fe !== drag.origEndMs;
      if (changed) {
        commitTimingUndo(moveSnap, `Mover cue #${moveUndoCueIndexRef.current}`);
      }
    }
    waveformMoveDragRef.current = null;
    setWaveformMoveDrag(null);
    /** Evita o `click` de compatibilidade no body da cue (que dispara seek via onClick). */
    if (didMove) {
      suppressWaveformInteractionUntilRef.current = performance.now() + 200;
      e.preventDefault();
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
      const edgeDrag = waveformEdgeDragRef.current;
      if (edgeDrag) {
        const acc = edgeDragLastPatchRef.current;
        edgeDragLastPatchRef.current = {};
        const snap = edgeUndoSnapshotRef.current;
        edgeUndoSnapshotRef.current = null;
        if (snap && commitTimingUndo && takeCuesSnapshotForUndo) {
          let finalStart = edgeDrag.origStartMs;
          let finalEnd = edgeDrag.origEndMs;
          if (acc.startMs != null) finalStart = acc.startMs as number;
          if (acc.endMs != null) finalEnd = acc.endMs as number;
          const changed =
            finalStart !== edgeDrag.origStartMs ||
            finalEnd !== edgeDrag.origEndMs;
          if (changed) {
            commitTimingUndo(
              snap,
              `Redimensionar cue #${edgeUndoCueIndexRef.current}`,
            );
          }
        }
      }
      const moveDrag = waveformMoveDragRef.current;
      let moveEndedWithMotion = false;
      if (moveDrag) {
        moveEndedWithMotion = moveDrag.moved;
        const mAcc = moveDragLastPatchRef.current;
        moveDragLastPatchRef.current = {};
        const moveSnap = moveUndoSnapshotRef.current;
        moveUndoSnapshotRef.current = null;
        if (
          moveSnap &&
          commitTimingUndo &&
          takeCuesSnapshotForUndo &&
          moveDrag.moved
        ) {
          const fs =
            mAcc.startMs != null ? (mAcc.startMs as number) : moveDrag.origStartMs;
          const fe =
            mAcc.endMs != null ? (mAcc.endMs as number) : moveDrag.origEndMs;
          const changed =
            fs !== moveDrag.origStartMs || fe !== moveDrag.origEndMs;
          if (changed) {
            commitTimingUndo(
              moveSnap,
              `Mover cue #${moveUndoCueIndexRef.current}`,
            );
          }
        }
      }
      waveformEdgeDragRef.current = null;
      waveformMoveDragRef.current = null;
      setWaveformEdgeDrag(null);
      setWaveformMoveDrag(null);
      suppressWaveformInteractionUntilRef.current =
        performance.now() + (moveEndedWithMotion ? 200 : 120);
    }
    window.addEventListener("pointerup", endFromWindow);
    window.addEventListener("pointercancel", endFromWindow);
    return () => {
      document.body.style.cursor = "";
      window.removeEventListener("pointerup", endFromWindow);
      window.removeEventListener("pointercancel", endFromWindow);
    };
  }, [
    waveformEdgeDrag,
    waveformMoveDrag,
    suppressWaveformInteractionUntilRef,
    updateCue,
    commitTimingUndo,
    takeCuesSnapshotForUndo,
  ]);

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
