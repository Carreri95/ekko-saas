"use client";

import { useEffect, useRef } from "react";
import type { UseKeyboardShortcutsParams } from "../types";

export function useKeyboardShortcuts({
  mediaElementRef,
  currentPlaybackMsRef,
  seekPlaybackToTimeSec,
  ensureWaveformPlayheadVisible,
  logBrowserError,
  isSpaceReservedForFocusedElement,
  editingCueTempId,
  setEditingCueTempId,
  undo,
  setCues,
  setSelectedCueTempId,
  setCueEditFocusTempId,
  waveformEdgeDragRef,
  waveformMoveDragRef,
  setSaveSuccess,
}: UseKeyboardShortcutsParams): void {
  const seekRef = useRef(seekPlaybackToTimeSec);
  const ensureVisibleRef = useRef(ensureWaveformPlayheadVisible);
  const logRef = useRef(logBrowserError);
  const spaceReserveRef = useRef(isSpaceReservedForFocusedElement);
  const undoRef = useRef(undo);
  const setCuesRef = useRef(setCues);
  const setSelectedCueRef = useRef(setSelectedCueTempId);
  const setCueEditFocusRef = useRef(setCueEditFocusTempId);
  const setEditingCueRef = useRef(setEditingCueTempId);
  const setSaveSuccessRef = useRef(setSaveSuccess);

  useEffect(() => {
    seekRef.current = seekPlaybackToTimeSec;
    ensureVisibleRef.current = ensureWaveformPlayheadVisible;
    logRef.current = logBrowserError;
    spaceReserveRef.current = isSpaceReservedForFocusedElement;
    undoRef.current = undo;
    setCuesRef.current = setCues;
    setSelectedCueRef.current = setSelectedCueTempId;
    setCueEditFocusRef.current = setCueEditFocusTempId;
    setEditingCueRef.current = setEditingCueTempId;
    setSaveSuccessRef.current = setSaveSuccess;
  }, [
    seekPlaybackToTimeSec,
    ensureWaveformPlayheadVisible,
    logBrowserError,
    isSpaceReservedForFocusedElement,
    undo,
    setCues,
    setSelectedCueTempId,
    setCueEditFocusTempId,
    setEditingCueTempId,
    setSaveSuccess,
  ]);

  /** Espaço = play/pause; setas = seek; Ctrl+Z = undo; não intercepta em inputs/textarea/editáveis. */
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const media = mediaElementRef.current;
      if (!media) return;
      if (spaceReserveRef.current(document.activeElement)) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (media.paused) {
          void media.play().catch((error) => {
            logRef.current("media.play on space key", error);
          });
        } else {
          media.pause();
        }
        return;
      }

      if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
        e.preventDefault();
        const deltaMs = e.shiftKey ? 100 : e.altKey ? 1000 : 500;
        const direction = e.code === "ArrowLeft" ? -1 : 1;
        const nextMs = Math.max(0, currentPlaybackMsRef.current + direction * deltaMs);
        const nextSec = nextMs / 1000;
        seekRef.current(nextSec);
        ensureVisibleRef.current(nextSec);
        return;
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "z" &&
        !e.shiftKey
      ) {
        if (spaceReserveRef.current(e.target)) return;
        if (waveformEdgeDragRef.current || waveformMoveDragRef.current) return;
        e.preventDefault();
        const didUndo = undoRef.current(setCuesRef.current);
        if (didUndo) {
          setSelectedCueRef.current(null);
          setCueEditFocusRef.current(null);
          setEditingCueRef.current(null);
          setSaveSuccessRef.current("Ação desfeita");
          window.setTimeout(() => {
            setSaveSuccessRef.current(null);
          }, 1500);
        }
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    mediaElementRef,
    currentPlaybackMsRef,
    waveformEdgeDragRef,
    waveformMoveDragRef,
  ]);

  /** Esc fecha o editor de texto da cue quando aberto. */
  useEffect(() => {
    if (!editingCueTempId) return;
    function onEsc(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setEditingCueTempId(null);
    }
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [editingCueTempId, setEditingCueTempId]);
}
