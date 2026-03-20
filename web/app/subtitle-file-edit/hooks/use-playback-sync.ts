"use client";

import { useEffect } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type WaveSurfer from "wavesurfer.js";

type UsePlaybackSyncParams = {
  mediaSourceUrl: string | null;
  mediaKind: "audio" | "video" | null;
  mediaElementRef: MutableRefObject<HTMLAudioElement | HTMLVideoElement | null>;
  waveSurferRef: MutableRefObject<WaveSurfer | null>;
  isWaveformSeekingRef: MutableRefObject<boolean>;
  suppressWaveformInteractionUntilRef: MutableRefObject<number>;
  waveformPanDragRef: MutableRefObject<unknown | null>;
  waveformOverviewDragRef: MutableRefObject<unknown | null>;
  waveformEdgeDragRef: MutableRefObject<unknown | null>;
  waveformMoveDragRef: MutableRefObject<unknown | null>;
  scheduleViewportRefreshRef: MutableRefObject<(() => void) | null>;
  setCurrentPlaybackMs: Dispatch<SetStateAction<number>>;
};

export function usePlaybackSync({
  mediaSourceUrl,
  mediaKind,
  mediaElementRef,
  waveSurferRef,
  isWaveformSeekingRef,
  suppressWaveformInteractionUntilRef,
  waveformPanDragRef,
  waveformOverviewDragRef,
  waveformEdgeDragRef,
  waveformMoveDragRef,
  scheduleViewportRefreshRef,
  setCurrentPlaybackMs,
}: UsePlaybackSyncParams): void {
  useEffect(() => {
    if (!mediaSourceUrl || mediaKind !== "audio") return;
    let cancelled = false;
    let rafId = 0;
    let lastUiAt = 0;
    let lastFollowAt = 0;
    const FOLLOW_MARGIN_RATIO = 0.1;
    const FOLLOW_CURSOR_ANCHOR_RATIO = 0.5;

    function stopRaf() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    }

    function tick() {
      if (cancelled) return;
      const media = mediaElementRef.current;
      const ws = waveSurferRef.current;
      if (!media || !ws || media.paused) {
        return;
      }
      if (!isWaveformSeekingRef.current) {
        const t = media.currentTime;
        // Auto-follow opcional: mantém o playhead dentro da janela visível durante reprodução.
        // Não força scroll enquanto o usuário estiver em interação manual.
        if (
          performance.now() >= suppressWaveformInteractionUntilRef.current &&
          !waveformPanDragRef.current &&
          !waveformOverviewDragRef.current &&
          !waveformEdgeDragRef.current &&
          !waveformMoveDragRef.current
        ) {
          const now = performance.now();
          if (now - lastFollowAt >= 48) {
            lastFollowAt = now;
            const durationSec = ws.getDuration();
            const wrapper = ws.getWrapper();
            const viewW = ws.getWidth();
            const totalW = Math.max(wrapper.scrollWidth, wrapper.offsetWidth);
            const maxScroll = Math.max(0, totalW - viewW);
            if (
              Number.isFinite(durationSec) &&
              durationSec > 0 &&
              totalW > 0 &&
              viewW > 0 &&
              maxScroll > 0
            ) {
              const playX = (t / durationSec) * totalW;
              const left = wrapper.scrollLeft;
              const right = left + viewW;
              const margin = Math.max(10, viewW * FOLLOW_MARGIN_RATIO);
              if (playX < left + margin || playX > right - margin) {
                const desired = playX - viewW * FOLLOW_CURSOR_ANCHOR_RATIO;
                const next = Math.max(0, Math.min(maxScroll, desired));
                ws.setScroll(next);
                scheduleViewportRefreshRef.current?.();
              }
            }
          }
        }
        const now = performance.now();
        if (now - lastUiAt >= 32) {
          lastUiAt = now;
          const nextMs = Math.floor(t * 1000);
          setCurrentPlaybackMs((prev) => (prev === nextMs ? prev : nextMs));
        }
      }
      rafId = requestAnimationFrame(tick);
    }

    function onPlay() {
      stopRaf();
      lastUiAt = 0;
      rafId = requestAnimationFrame(tick);
    }

    function onPauseOrEnded() {
      stopRaf();
      const media = mediaElementRef.current;
      if (!media || cancelled) return;
      const nextMs = Math.floor(media.currentTime * 1000);
      setCurrentPlaybackMs((prev) => (prev === nextMs ? prev : nextMs));
    }

    let boundMedia: HTMLMediaElement | null = null;

    function tryAttach(attempt = 0) {
      if (cancelled) return;
      const media = mediaElementRef.current;
      if (!media) {
        if (attempt < 40) {
          requestAnimationFrame(() => tryAttach(attempt + 1));
        }
        return;
      }
      boundMedia = media;
      media.addEventListener("play", onPlay);
      media.addEventListener("pause", onPauseOrEnded);
      media.addEventListener("ended", onPauseOrEnded);
      if (!media.paused) onPlay();
    }

    const boot = requestAnimationFrame(() => tryAttach());

    return () => {
      cancelled = true;
      cancelAnimationFrame(boot);
      stopRaf();
      if (boundMedia) {
        boundMedia.removeEventListener("play", onPlay);
        boundMedia.removeEventListener("pause", onPauseOrEnded);
        boundMedia.removeEventListener("ended", onPauseOrEnded);
      }
    };
  }, [
    mediaSourceUrl,
    mediaKind,
    mediaElementRef,
    waveSurferRef,
    isWaveformSeekingRef,
    suppressWaveformInteractionUntilRef,
    waveformPanDragRef,
    waveformOverviewDragRef,
    waveformEdgeDragRef,
    waveformMoveDragRef,
    scheduleViewportRefreshRef,
    setCurrentPlaybackMs,
  ]);
}
