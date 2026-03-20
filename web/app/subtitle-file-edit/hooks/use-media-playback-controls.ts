"use client";

import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type WaveSurfer from "wavesurfer.js";

type UseMediaPlaybackControlsParams = {
  mediaElementRef: MutableRefObject<HTMLAudioElement | HTMLVideoElement | null>;
  waveSurferRef: MutableRefObject<WaveSurfer | null>;
  /** Velocidade de reprodução (ex.: 1.0) — aplicada antes de `play()`. */
  playbackRateRef: MutableRefObject<number>;
  isWaveformSeekingRef: MutableRefObject<boolean>;
  setCurrentPlaybackMs: Dispatch<SetStateAction<number>>;
  logBrowserError: (context: string, error: unknown) => void;
};

export function useMediaPlaybackControls({
  mediaElementRef,
  waveSurferRef,
  playbackRateRef,
  isWaveformSeekingRef,
  setCurrentPlaybackMs,
  logBrowserError,
}: UseMediaPlaybackControlsParams) {
  const seekPlaybackToTimeSec = useCallback(
    (nextTimeSec: number) => {
      const media = mediaElementRef.current;
      const ws = waveSurferRef.current;
      if (!media || !ws || !Number.isFinite(nextTimeSec)) return;
      const wasPaused = media.paused;
      const clamped = Math.max(0, nextTimeSec);
      isWaveformSeekingRef.current = true;
      media.currentTime = clamped;
      ws.setTime(clamped);
      const nextMs = Math.floor(clamped * 1000);
      setCurrentPlaybackMs((prev) => (prev === nextMs ? prev : nextMs));
      // Clique/seek na waveform nunca deve iniciar reprodução sozinho.
      if (wasPaused) {
        media.pause();
        ws.pause();
      }
      window.setTimeout(() => {
        isWaveformSeekingRef.current = false;
      }, 120);
    },
    [mediaElementRef, waveSurferRef, isWaveformSeekingRef, setCurrentPlaybackMs],
  );

  /**
   * Mapeia clientX → tempo na mesma geometria que o desenho das cues (totalW + scroll).
   * scrollLeft é obrigatório quando a waveform está scrollada horizontalmente.
   */
  const seekPlaybackFromWaveClientX = useCallback(
    (clientX: number) => {
      const ws = waveSurferRef.current;
      if (!ws) return;
      const durationSec = ws.getDuration();
      const wrapper = ws.getWrapper();
      if (!Number.isFinite(durationSec) || durationSec <= 0 || !wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      if (rect.width <= 0) return;
      const viewportX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const totalW = Math.max(wrapper.scrollWidth, wrapper.offsetWidth);
      if (totalW <= 0) return;
      const absoluteX = wrapper.scrollLeft + viewportX;
      const ratio = Math.max(0, Math.min(1, absoluteX / totalW));
      seekPlaybackToTimeSec(ratio * durationSec);
    },
    [waveSurferRef, seekPlaybackToTimeSec],
  );

  const scrollWaveformToCueStart = useCallback(
    (startMs: number) => {
      const ws = waveSurferRef.current;
      if (!ws) return;
      ws.setScrollTime(Math.max(0, startMs / 1000));
    },
    [waveSurferRef],
  );

  /**
   * Mantém a barra do playhead dentro da área visível ao fazer seek (ex.: setas do teclado).
   * Usa a mesma geometria que o clique na waveform (ratio × totalW).
   */
  const ensureWaveformPlayheadVisible = useCallback(
    (timeSec: number) => {
      const ws = waveSurferRef.current;
      if (!ws || !Number.isFinite(timeSec)) return;
      const durationSec = ws.getDuration();
      if (!Number.isFinite(durationSec) || durationSec <= 0) return;
      const wrapper = ws.getWrapper();
      if (!wrapper) return;
      const totalW = Math.max(wrapper.scrollWidth, wrapper.offsetWidth);
      const viewW = ws.getWidth();
      if (totalW <= 0 || viewW <= 0) return;
      const maxScroll = Math.max(0, totalW - viewW);
      if (maxScroll <= 0) return;

      const clampedTime = Math.max(0, Math.min(durationSec, timeSec));
      const playheadX = (clampedTime / durationSec) * totalW;
      const margin = Math.min(56, Math.max(24, viewW * 0.12));
      let scroll = ws.getScroll();

      if (playheadX < scroll + margin) {
        scroll = Math.max(0, playheadX - margin);
      } else if (playheadX > scroll + viewW - margin) {
        scroll = Math.min(maxScroll, playheadX - viewW + margin);
      } else {
        return;
      }

      ws.setScroll(scroll);
    },
    [waveSurferRef],
  );

  const seekPlayerToCue = useCallback(
    (startMs: number) => {
      seekPlaybackToTimeSec(startMs / 1000);
    },
    [seekPlaybackToTimeSec],
  );

  const playMedia = useCallback(async () => {
    const media = mediaElementRef.current;
    if (!media) return;
    const r = playbackRateRef.current;
    if (typeof r === "number" && Number.isFinite(r) && r > 0) {
      media.playbackRate = r;
      media.defaultPlaybackRate = r;
    }
    try {
      await media.play();
    } catch (error) {
      logBrowserError("playMedia media.play()", error);
      // Ignora bloqueio de autoplay sem quebrar o fluxo.
    }
  }, [mediaElementRef, playbackRateRef, logBrowserError]);

  const pauseMedia = useCallback(() => {
    const media = mediaElementRef.current;
    if (!media) return;
    media.pause();
  }, [mediaElementRef]);

  const resetMediaToStart = useCallback(() => {
    const media = mediaElementRef.current;
    if (!media) return;
    media.currentTime = 0;
    setCurrentPlaybackMs(0);
    waveSurferRef.current?.setTime(0);
  }, [mediaElementRef, setCurrentPlaybackMs, waveSurferRef]);

  const handleMediaTimeUpdate = useCallback(
    (currentTimeSec: number) => {
      const media = mediaElementRef.current;
      if (media && !media.paused) {
        // Em play, o rAF mantém o WaveSurfer alinhado ao relógio do elemento.
        return;
      }
      const nextMs = Math.floor(currentTimeSec * 1000);
      setCurrentPlaybackMs((prev) => (prev === nextMs ? prev : nextMs));
      if (isWaveformSeekingRef.current) return;
      waveSurferRef.current?.setTime(currentTimeSec);
    },
    [mediaElementRef, setCurrentPlaybackMs, isWaveformSeekingRef, waveSurferRef],
  );

  return {
    seekPlaybackToTimeSec,
    seekPlaybackFromWaveClientX,
    scrollWaveformToCueStart,
    ensureWaveformPlayheadVisible,
    seekPlayerToCue,
    playMedia,
    pauseMedia,
    resetMediaToStart,
    handleMediaTimeUpdate,
  };
}
