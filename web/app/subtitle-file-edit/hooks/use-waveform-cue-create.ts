"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { Dispatch, MutableRefObject, PointerEvent as ReactPointerEvent, SetStateAction } from "react";
import type WaveSurfer from "wavesurfer.js";
import { createTempId, reindexCues } from "../lib/cue-utils";
import type { CueDto } from "../types";

const MOVE_THRESHOLD_PX = 6;

/**
 * Evita iniciar o drag de criação quando o clique cai numa região de cue existente
 * (ou num filho: body, handles, preview). Usa `closest` no target e, em seguida,
 * `composedPath` para cobrir retargeting / Shadow DOM (o target no listener da shell
 * pode não ser o nó profundo).
 */
export function isPointerOnExistingCue(
  target: EventTarget | null,
  nativeEvent?: PointerEvent,
): boolean {
  if (target instanceof Element) {
    if (target.closest('[data-editor-cue-sync="region"]')) return true;
  }
  if (nativeEvent && typeof nativeEvent.composedPath === "function") {
    for (const node of nativeEvent.composedPath()) {
      if (
        node instanceof Element &&
        node.getAttribute("data-editor-cue-sync") === "region"
      ) {
        return true;
      }
    }
  }
  return false;
}

/** @deprecated Use {@link isPointerOnExistingCue} */
export const isPointerOnExistingCueRegion = isPointerOnExistingCue;

function clientXToMs(
  clientX: number,
  ws: WaveSurfer,
  durationSec: number,
): number | null {
  const wrapper = ws.getWrapper();
  if (!wrapper) return null;
  const rect = wrapper.getBoundingClientRect();
  if (rect.width <= 0) return null;
  const totalW = Math.max(wrapper.scrollWidth, wrapper.offsetWidth);
  if (totalW <= 0 || !Number.isFinite(durationSec) || durationSec <= 0) return null;
  const viewportX = Math.max(0, Math.min(rect.width, clientX - rect.left));
  const absoluteX = wrapper.scrollLeft + viewportX;
  const ratio = Math.max(0, Math.min(1, absoluteX / totalW));
  return Math.round(ratio * durationSec * 1000);
}

function previewPxFromMsRange(
  startMs: number,
  endMs: number,
  durationSec: number,
  totalW: number,
): { leftPx: number; widthPx: number } | null {
  if (durationSec <= 0 || totalW <= 0) return null;
  const dur = durationSec;
  const lo = Math.min(startMs, endMs);
  const hi = Math.max(startMs, endMs);
  const startSec = Math.min(dur, Math.max(0, lo / 1000));
  const endSec = Math.min(dur, Math.max(startSec, hi / 1000));
  const leftPx = (startSec / dur) * totalW;
  const rightPx = (endSec / dur) * totalW;
  const widthPx = Math.max(0, rightPx - leftPx);
  return { leftPx, widthPx };
}

/** Limites do intervalo vazio onde o ponteiro pode esticar a nova cue (paredes nas cues vizinhas). */
export function getCreateBounds(
  startMs: number,
  cues: CueDto[],
): { leftBoundMs: number; rightBoundMs: number } {
  const sorted = [...cues].sort((a, b) => a.startMs - b.startMs);

  const leftCue = [...sorted].reverse().find((c) => c.endMs <= startMs);
  const leftBoundMs = leftCue ? leftCue.endMs : 0;

  const rightCue = sorted.find((c) => c.startMs >= startMs);
  const rightBoundMs = rightCue ? rightCue.startMs : Number.POSITIVE_INFINITY;

  return { leftBoundMs, rightBoundMs };
}

function clampCreatePointerMs(
  ms: number,
  leftBoundMs: number,
  rightBoundMs: number,
  durationMs: number,
): number {
  const hi = Math.min(
    Number.isFinite(rightBoundMs) ? rightBoundMs : durationMs,
    durationMs,
  );
  return Math.max(leftBoundMs, Math.min(hi, ms));
}

export type CueCreateDragState = {
  startX: number;
  startMs: number;
  currentX: number;
  pointerId: number;
  leftBoundMs: number;
  rightBoundMs: number;
};

export type UseWaveformCueCreateParams = {
  waveSurferRef: MutableRefObject<WaveSurfer | null>;
  waveformDurationSec: number | null;
  waveformTotalWidthPx: number | null;
  cues: CueDto[];
  setCues: Dispatch<SetStateAction<CueDto[]>>;
  setSelectedCueTempId: Dispatch<SetStateAction<string | null>>;
  minGapMs: number;
  seekPlaybackFromWaveClientX: (clientX: number) => void;
  waveformEdgeDragRef: MutableRefObject<unknown>;
  waveformMoveDragRef: MutableRefObject<unknown>;
  waveformOverviewDragRef: MutableRefObject<{ pointerId: number } | null>;
  /** Grava estado antes de criar cue (pointerup). */
  pushHistory?: (cuesSnapshot: CueDto[], label: string) => void;
};

export function useWaveformCueCreate({
  waveSurferRef,
  waveformDurationSec,
  waveformTotalWidthPx,
  cues,
  setCues,
  setSelectedCueTempId,
  minGapMs,
  seekPlaybackFromWaveClientX,
  waveformEdgeDragRef,
  waveformMoveDragRef,
  waveformOverviewDragRef,
  pushHistory,
}: UseWaveformCueCreateParams) {
  const [cueCreateDrag, setCueCreateDrag] = useState<CueCreateDragState | null>(null);

  const cuesRef = useRef(cues);
  cuesRef.current = cues;

  const sessionRef = useRef<{
    pointerId: number;
    startMs: number;
    endMs: number;
    startClientX: number;
    dragging: boolean;
    leftBoundMs: number;
    rightBoundMs: number;
  } | null>(null);

  const cueCreatePreviewRect = useMemo(() => {
    if (
      !cueCreateDrag ||
      waveformDurationSec == null ||
      waveformDurationSec <= 0 ||
      waveformTotalWidthPx == null ||
      waveformTotalWidthPx <= 0
    ) {
      return null;
    }
    const ws = waveSurferRef.current;
    if (!ws) return null;
    const rawEnd =
      clientXToMs(cueCreateDrag.currentX, ws, waveformDurationSec) ??
      cueCreateDrag.startMs;
    const durationMs = Math.round(waveformDurationSec * 1000);
    const endMs = clampCreatePointerMs(
      rawEnd,
      cueCreateDrag.leftBoundMs,
      cueCreateDrag.rightBoundMs,
      durationMs,
    );
    return previewPxFromMsRange(
      cueCreateDrag.startMs,
      endMs,
      waveformDurationSec,
      waveformTotalWidthPx,
    );
  }, [cueCreateDrag, waveformDurationSec, waveformTotalWidthPx, waveSurferRef]);

  const onPointerDownCapture = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (isPointerOnExistingCue(e.target, e.nativeEvent)) return;
      if (e.button !== 0) return;
      if (waveformEdgeDragRef.current || waveformMoveDragRef.current) return;
      if (waveformOverviewDragRef.current) return;

      const shell = e.currentTarget as HTMLDivElement;
      const ws = waveSurferRef.current;
      const dur = waveformDurationSec;
      if (!ws || dur == null || dur <= 0) return;

      const startMs = clientXToMs(e.clientX, ws, dur);
      if (startMs == null) return;

      const { leftBoundMs, rightBoundMs } = getCreateBounds(
        startMs,
        cuesRef.current,
      );

      sessionRef.current = {
        pointerId: e.pointerId,
        startMs,
        endMs: startMs,
        startClientX: e.clientX,
        dragging: false,
        leftBoundMs,
        rightBoundMs,
      };

      try {
        shell.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      const onMove = (ev: PointerEvent) => {
        const s = sessionRef.current;
        if (!s || ev.pointerId !== s.pointerId) return;
        const w = waveSurferRef.current;
        const durationSec = waveformDurationSec;
        if (!w || durationSec == null || durationSec <= 0) return;
        const rawEnd = clientXToMs(ev.clientX, w, durationSec);
        if (rawEnd == null) return;
        const durationMs = Math.round(durationSec * 1000);
        const endMs = clampCreatePointerMs(
          rawEnd,
          s.leftBoundMs,
          s.rightBoundMs,
          durationMs,
        );
        s.endMs = endMs;
        if (Math.abs(ev.clientX - s.startClientX) > MOVE_THRESHOLD_PX) {
          s.dragging = true;
        }
        if (s.dragging) {
          setCueCreateDrag({
            startX: s.startClientX,
            startMs: s.startMs,
            currentX: ev.clientX,
            pointerId: s.pointerId,
            leftBoundMs: s.leftBoundMs,
            rightBoundMs: s.rightBoundMs,
          });
        }
      };

      const onUp = (ev: PointerEvent) => {
        const s = sessionRef.current;
        if (!s || ev.pointerId !== s.pointerId) return;

        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);

        sessionRef.current = null;
        setCueCreateDrag(null);

        try {
          shell.releasePointerCapture(ev.pointerId);
        } catch {
          /* ignore */
        }

        const w = waveSurferRef.current;
        const durationSec = waveformDurationSec;
        if (!w || durationSec == null || durationSec <= 0) return;

        const rawFinal = clientXToMs(ev.clientX, w, durationSec);
        if (rawFinal == null) return;
        const durationMs = Math.round(durationSec * 1000);
        const finalEndMs = clampCreatePointerMs(
          rawFinal,
          s.leftBoundMs,
          s.rightBoundMs,
          durationMs,
        );

        if (!s.dragging) {
          seekPlaybackFromWaveClientX(ev.clientX);
          return;
        }

        let startMs = Math.min(s.startMs, finalEndMs);
        let endMs = Math.max(s.startMs, finalEndMs);
        if (endMs - startMs < minGapMs) {
          return;
        }

        const overlaps = cuesRef.current.some(
          (c) => !(endMs <= c.startMs || startMs >= c.endMs),
        );
        if (overlaps) {
          return;
        }

        const newCue: CueDto = {
          id: null,
          tempId: createTempId(),
          cueIndex: 0,
          startMs,
          endMs,
          text: "",
        };

        pushHistory?.(cuesRef.current, "Criar cue");

        setCues((prev) => {
          const next = [...prev, newCue].sort((a, b) => a.startMs - b.startMs);
          return reindexCues(next);
        });
        setSelectedCueTempId(newCue.tempId);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [
      waveSurferRef,
      waveformDurationSec,
      minGapMs,
      seekPlaybackFromWaveClientX,
      setCues,
      setSelectedCueTempId,
      waveformEdgeDragRef,
      waveformMoveDragRef,
      waveformOverviewDragRef,
      pushHistory,
    ],
  );

  return {
    cueCreateDrag,
    cueCreatePreviewRect,
    onWaveformShellPointerDownCapture: onPointerDownCapture,
  };
}
