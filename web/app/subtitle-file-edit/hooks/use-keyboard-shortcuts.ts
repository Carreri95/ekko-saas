"use client";

import { useEffect, useRef } from "react";

type UseKeyboardShortcutsParams = {
  mediaElementRef: React.MutableRefObject<HTMLAudioElement | HTMLVideoElement | null>;
  currentPlaybackMsRef: React.MutableRefObject<number>;
  seekPlaybackToTimeSec: (sec: number) => void;
  logBrowserError: (context: string, error: unknown) => void;
  isSpaceReservedForFocusedElement: (target: EventTarget | null) => boolean;
  editingCueTempId: string | null;
  setEditingCueTempId: React.Dispatch<React.SetStateAction<string | null>>;
};

export function useKeyboardShortcuts({
  mediaElementRef,
  currentPlaybackMsRef,
  seekPlaybackToTimeSec,
  logBrowserError,
  isSpaceReservedForFocusedElement,
  editingCueTempId,
  setEditingCueTempId,
}: UseKeyboardShortcutsParams): void {
  const seekRef = useRef(seekPlaybackToTimeSec);
  const logRef = useRef(logBrowserError);
  const spaceReserveRef = useRef(isSpaceReservedForFocusedElement);

  useEffect(() => {
    seekRef.current = seekPlaybackToTimeSec;
    logRef.current = logBrowserError;
    spaceReserveRef.current = isSpaceReservedForFocusedElement;
  }, [seekPlaybackToTimeSec, logBrowserError, isSpaceReservedForFocusedElement]);

  /** Espaço = play/pause; setas = seek; não intercepta em inputs/textarea/editáveis. */
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
        seekRef.current(nextMs / 1000);
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [mediaElementRef, currentPlaybackMsRef]);

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
