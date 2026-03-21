"use client";

import { useEffect } from "react";
import type { UsePlaybackSyncParams } from "../types";

export function usePlaybackSync({
  mediaSourceUrl,
  mediaKind,
  mediaElementRef,
  isWaveformSeekingRef,
  setCurrentPlaybackMs,
  waveSurferRef,
  scheduleViewportRefreshRef,
  waveformOverviewDragRef,
  waveformEdgeDragRef,
  waveformMoveDragRef,
  waveformPanDragRef,
  suppressPlayheadFollowUntilRef,
}: UsePlaybackSyncParams): void {
  useEffect(() => {
    if (!mediaSourceUrl || mediaKind !== "audio") return;
    let cancelled = false;
    let rafId = 0;
    let lastUiAt = 0;
    let lastFollowAt = 0;

    function stopRaf() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    }

    function tick() {
      if (cancelled) return;
      const media = mediaElementRef.current;
      if (!media || media.paused) {
        return;
      }

      const t = media.currentTime;

      if (!isWaveformSeekingRef.current) {
        const now = performance.now();
        if (now - lastUiAt >= 32) {
          lastUiAt = now;
          const nextMs = Math.floor(t * 1000);
          setCurrentPlaybackMs((prev) => (prev === nextMs ? prev : nextMs));
        }
      }

      const ws = waveSurferRef.current;
      if (
        ws &&
        !isWaveformSeekingRef.current &&
        performance.now() >= suppressPlayheadFollowUntilRef.current &&
        !waveformPanDragRef?.current &&
        !waveformOverviewDragRef.current &&
        !waveformEdgeDragRef.current &&
        !waveformMoveDragRef.current
      ) {
        const now = performance.now();
        if (now - lastFollowAt >= 80) {
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
            const currentScroll = ws.getScroll();
            const threshold = currentScroll + viewW * 0.82;

            if (playX > threshold) {
              const desired = playX - viewW * 0.15;
              const next = Math.max(0, Math.min(maxScroll, desired));

              if (Math.abs(next - currentScroll) > 2) {
                ws.setScroll(next);
                scheduleViewportRefreshRef.current?.();
              }
            }
          }
        }
      }

      rafId = requestAnimationFrame(tick);
    }

    function onPlay() {
      stopRaf();
      lastUiAt = 0;
      lastFollowAt = 0;
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
    isWaveformSeekingRef,
    setCurrentPlaybackMs,
    waveSurferRef,
    scheduleViewportRefreshRef,
    waveformOverviewDragRef,
    waveformEdgeDragRef,
    waveformMoveDragRef,
    waveformPanDragRef,
    suppressPlayheadFollowUntilRef,
  ]);
}
