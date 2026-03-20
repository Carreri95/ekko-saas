"use client";

import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { LocalWaveformData } from "../types";

type UseMediaSessionControlsParams = {
  mediaElementRef: MutableRefObject<HTMLAudioElement | HTMLVideoElement | null>;
  waveSurferRef: MutableRefObject<WaveSurfer | null>;
  scheduleViewportRefreshRef: MutableRefObject<(() => void) | null>;
  setLocalWaveformData: Dispatch<SetStateAction<LocalWaveformData | null>>;
  setMediaSourceUrl: Dispatch<SetStateAction<string | null>>;
  setMediaKind: Dispatch<SetStateAction<"video" | "audio" | null>>;
  setCurrentPlaybackMs: Dispatch<SetStateAction<number>>;
};

export function useMediaSessionControls({
  mediaElementRef,
  waveSurferRef,
  scheduleViewportRefreshRef,
  setLocalWaveformData,
  setMediaSourceUrl,
  setMediaKind,
  setCurrentPlaybackMs,
}: UseMediaSessionControlsParams) {
  const clearMedia = useCallback(() => {
    setLocalWaveformData(null);
    setMediaSourceUrl(null);
    setMediaKind(null);
    setCurrentPlaybackMs(0);
  }, [setLocalWaveformData, setMediaSourceUrl, setMediaKind, setCurrentPlaybackMs]);

  const resetPlaybackToStart = useCallback(() => {
    setCurrentPlaybackMs(0);
    const media = mediaElementRef.current;
    if (media) {
      media.currentTime = 0;
    }
    const ws = waveSurferRef.current;
    if (ws) {
      ws.setTime(0);
      ws.setScroll(0);
      scheduleViewportRefreshRef.current?.();
    }
  }, [setCurrentPlaybackMs, mediaElementRef, waveSurferRef, scheduleViewportRefreshRef]);

  return { clearMedia, resetPlaybackToStart };
}
