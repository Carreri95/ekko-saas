"use client";

import { useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import type { UseWaveformLifecycleParams } from "../types";

export function useWaveformLifecycle({
  waveformEnabled,
  localWaveformData,
  bindPanSeekHandlers,
  mediaSourceUrl,
  mediaKind,
  wavPath,
  waveformPx,
  waveformMinPxPerSec,
  waveformContainerRef,
  mediaElementRef,
  waveSurferRef,
  waveformCueOverlayHostRef,
  waveformViewportLastRef,
  scheduleViewportRefreshRef,
  waveformOverviewDragRef,
  waveformEdgeDragRef,
  waveformMoveDragRef,
  suppressWaveformInteractionUntilRef,
  suppressPlayheadFollowUntilRef,
  audioRouteFallbackTriedRef,
  setWaveformDurationSec,
  setWaveformCueOverlayHostEl,
  setWaveformViewport,
  setError,
  setMediaSourceUrl,
  seekPlaybackToTimeSec,
  logBrowserError,
  normalizeBrowserMediaPath,
  injectWaveformCueShadowStyles,
}: UseWaveformLifecycleParams): void {
  const wavPathRef = useRef(wavPath);
  const normalizePathRef = useRef(normalizeBrowserMediaPath);
  const seekPlaybackRef = useRef(seekPlaybackToTimeSec);
  const logErrorRef = useRef(logBrowserError);
  const lastWaveErrorKeyRef = useRef<string>("");

  function getWaveErrorDetail(err: unknown): string {
    if (err instanceof Error) return err.message || "Erro desconhecido";
    if (typeof err === "string") return err;
    if (typeof err === "object" && err !== null) {
      const maybeMessage = (err as { message?: unknown }).message;
      if (typeof maybeMessage === "string" && maybeMessage.trim())
        return maybeMessage;
      const maybeError = (err as { error?: unknown }).error;
      if (typeof maybeError === "string" && maybeError.trim())
        return maybeError;
    }
    return String(err);
  }

  function summarizeMediaSource(url: string | null): string {
    if (!url) return "null";
    if (url.startsWith("blob:")) return `blob:${url.slice(5, 45)}...`;
    if (url.startsWith("data:")) return `data:${url.slice(5, 40)}...`;
    return url.length > 120 ? `${url.slice(0, 120)}...` : url;
  }

  useEffect(() => {
    wavPathRef.current = wavPath;
    normalizePathRef.current = normalizeBrowserMediaPath;
    seekPlaybackRef.current = seekPlaybackToTimeSec;
    logErrorRef.current = logBrowserError;
  }, [
    wavPath,
    normalizeBrowserMediaPath,
    seekPlaybackToTimeSec,
    logBrowserError,
  ]);

  useEffect(() => {
    if (!waveformContainerRef.current) return;

    if (!waveformEnabled || !mediaSourceUrl || mediaKind !== "audio") {
      setWaveformDurationSec(null);
      setWaveformCueOverlayHostEl(null);
      waveformCueOverlayHostRef.current = null;
      if (waveSurferRef.current) {
        waveSurferRef.current.destroy();
        waveSurferRef.current = null;
      }
      return;
    }

    const isLocalEphemeralSource =
      mediaSourceUrl.startsWith("blob:") || mediaSourceUrl.startsWith("data:");
    if (isLocalEphemeralSource && !localWaveformData) {
      setWaveformDurationSec(null);
      setWaveformCueOverlayHostEl(null);
      waveformCueOverlayHostRef.current = null;
      if (waveSurferRef.current) {
        waveSurferRef.current.destroy();
        waveSurferRef.current = null;
      }
      setError(null);
      return;
    }

    // Normaliza blob URLs com fragmento legado (#...) para evitar falhas no fetch interno.
    if (mediaSourceUrl.startsWith("blob:") && mediaSourceUrl.includes("#")) {
      const cleanBlobUrl = mediaSourceUrl.split("#")[0];
      setMediaSourceUrl(cleanBlobUrl);
      return;
    }

    audioRouteFallbackTriedRef.current = false;

    setWaveformDurationSec(null);
    setWaveformCueOverlayHostEl(null);
    waveformCueOverlayHostRef.current = null;

    if (waveSurferRef.current) {
      waveSurferRef.current.destroy();
      waveSurferRef.current = null;
    }

    const mediaEl = mediaElementRef.current;

    // Garante que o elemento de mídia esteja sincronizado antes de criar o WaveSurfer.
    // Em alguns navegadores, criar a instância durante a troca de blob URL pode disparar
    // "Failed to fetch" se o elemento ainda não aplicou o src internamente.
    if (mediaEl && mediaKind === "audio") {
      if (mediaEl.src !== mediaSourceUrl) {
        mediaEl.src = mediaSourceUrl;
      }
      mediaEl.load();
    }

    const waveBaseOptions = {
      container: waveformContainerRef.current,
      /** Barras nativas ocultas — overlay canvas em `use-waveform-canvas-overlay.ts`. */
      waveColor: "rgba(0,0,0,0)",
      progressColor: "rgba(0,0,0,0)",
      cursorColor: "rgba(0,0,0,0)",
      cursorWidth: 1,
      barWidth: 2,
      barGap: 1,
      barRadius: 1,
      // Quanto maior, mais “cheia” a onda na altura (1 = máximo teórico; padding no container evita clipping).
      barHeight: 0.88,
      barMinHeight: 1,
      // Altura cheia; respiro vertical vem do padding no container (timeline-dock).
      height: waveformPx,
      minPxPerSec: waveformMinPxPerSec,
      fillParent: false,
      hideScrollbar: true,
      normalize: true,
      dragToSeek: false,
      interact: false,
      autoScroll: false,
      autoCenter: false,
      backend: "MediaElement" as const,
    };

    const useLocalWaveformData =
      Boolean(localWaveformData) && isLocalEphemeralSource;

    const waveSurfer = WaveSurfer.create({
      ...waveBaseOptions,
      ...(useLocalWaveformData && localWaveformData
        ? {
            peaks: localWaveformData.peaks,
            duration: localWaveformData.duration,
          }
        : {}),
      ...(mediaEl && mediaKind === "audio" ? { media: mediaEl } : {}),
    });

    waveSurferRef.current = waveSurfer;

    if (!useLocalWaveformData) {
      void waveSurfer.load(mediaSourceUrl).catch((loadError) => {
        logErrorRef.current("waveSurfer load url error", {
          detail: getWaveErrorDetail(loadError),
          mediaKind,
          mediaSourceUrl: summarizeMediaSource(mediaSourceUrl),
        });
      });
    } else {
      setError(null);
    }

    let cleanupPanSeekHandlers: (() => void) | null = null;

    function refreshWaveformViewport() {
      const ws = waveSurfer;
      const wrapper = ws.getWrapper();
      if (!wrapper) return;
      const totalW = Math.max(wrapper.scrollWidth, wrapper.offsetWidth);
      const viewW = ws.getWidth();
      const maxScroll = Math.max(0, totalW - viewW);
      const scrollPx = Math.max(0, Math.min(maxScroll, ws.getScroll()));
      const next = { scroll: scrollPx, maxScroll, viewW, totalW };
      const prev = waveformViewportLastRef.current;
      if (
        prev &&
        Math.abs(prev.scroll - next.scroll) < 0.5 &&
        Math.abs(prev.maxScroll - next.maxScroll) < 0.5 &&
        Math.abs(prev.viewW - next.viewW) < 0.5 &&
        Math.abs(prev.totalW - next.totalW) < 0.5
      ) {
        return;
      }
      waveformViewportLastRef.current = next;
      setWaveformViewport(next);
    }

    let rafViewportUi = 0;
    function scheduleViewportRefresh() {
      if (rafViewportUi) return;
      rafViewportUi = requestAnimationFrame(() => {
        rafViewportUi = 0;
        refreshWaveformViewport();
      });
    }
    scheduleViewportRefreshRef.current = scheduleViewportRefresh;

    const applyDuration = (sec: number) => {
      if (Number.isFinite(sec) && sec > 0) {
        setWaveformDurationSec(sec);
      }
    };

    function syncCueOverlayHostSize() {
      const wrapper = waveSurfer.getWrapper();
      const host = waveformCueOverlayHostRef.current;
      if (!wrapper || !host) return;
      const totalW = Math.max(wrapper.scrollWidth, wrapper.offsetWidth);
      const h = Math.max(1, wrapper.clientHeight);
      host.style.width = `${totalW}px`;
      host.style.minWidth = `${totalW}px`;
      host.style.height = `${h}px`;
      host.style.minHeight = `${h}px`;
    }

    function mountCueOverlayHost() {
      const wrapper = waveSurfer.getWrapper();
      if (!wrapper) return;
      injectWaveformCueShadowStyles(wrapper.getRootNode());
      const prev = waveformCueOverlayHostRef.current;
      if (prev && prev.parentNode) {
        prev.parentNode.removeChild(prev);
      }
      wrapper.style.position = "relative";
      const host = document.createElement("div");
      host.className = "editor-waveform-cue-overlay-host";
      host.setAttribute("aria-hidden", "true");
      host.style.cssText = [
        "position:absolute",
        "left:0",
        "top:0",
        "width:0",
        "height:100%",
        "min-height:100%",
        "pointer-events:none",
        "z-index:6",
      ].join(";");
      wrapper.appendChild(host);
      waveformCueOverlayHostRef.current = host;
      setWaveformCueOverlayHostEl(host);
      syncCueOverlayHostSize();
    }

    let wrapperResizeObserver: ResizeObserver | null = null;

    waveSurfer.on("ready", () => {
      applyDuration(waveSurfer.getDuration());
      mountCueOverlayHost();
      const wrap = waveSurfer.getWrapper();
      if (wrap && typeof ResizeObserver !== "undefined") {
        wrapperResizeObserver?.disconnect();
        wrapperResizeObserver = new ResizeObserver(() => {
          syncCueOverlayHostSize();
          scheduleViewportRefresh();
        });
        wrapperResizeObserver.observe(wrap);
      }
      cleanupPanSeekHandlers?.();
      cleanupPanSeekHandlers = bindPanSeekHandlers({
        waveSurfer,
        suppressWaveformInteractionUntilRef,
        suppressPlayheadFollowUntilRef,
        waveformEdgeDragRef,
        waveformMoveDragRef,
        waveformOverviewDragRef,
        scheduleViewportRefresh,
      });
      refreshWaveformViewport();
    });

    waveSurfer.on("redraw", () => {
      if (!waveformCueOverlayHostRef.current && waveSurfer.getWrapper()) {
        mountCueOverlayHost();
      }
      syncCueOverlayHostSize();
      scheduleViewportRefresh();
    });

    waveSurfer.on("zoom", () => {
      const wsDur = waveSurfer.getDuration();
      if (Number.isFinite(wsDur) && wsDur > 0) {
        setWaveformDurationSec((prev) => {
          if (prev != null && Math.abs(prev - wsDur) < 0.01) return prev;
          return wsDur;
        });
      }
      const w = waveSurfer.getWrapper();
      const h = waveformCueOverlayHostRef.current;
      if (w && (!h || !w.contains(h))) {
        mountCueOverlayHost();
      }
      syncCueOverlayHostSize();
      scheduleViewportRefresh();
    });

    waveSurfer.on("resize", () => {
      syncCueOverlayHostSize();
      scheduleViewportRefresh();
    });

    waveSurfer.on("error", (err) => {
      const detail = getWaveErrorDetail(err);
      const waveErrorKey = `${detail}|${mediaKind}|${mediaSourceUrl ?? "null"}`;
      if (lastWaveErrorKeyRef.current !== waveErrorKey) {
        lastWaveErrorKeyRef.current = waveErrorKey;
        logErrorRef.current("waveSurfer error", {
          detail,
          mediaSourceUrl: summarizeMediaSource(mediaSourceUrl),
          wavPath: wavPathRef.current,
          mediaKind,
          usedExternalMediaElement: Boolean(mediaEl && mediaKind === "audio"),
        });
      }
      const directWavPath = normalizePathRef.current(wavPathRef.current);
      const canTryDirectWavPath =
        !audioRouteFallbackTriedRef.current &&
        mediaSourceUrl?.includes("/api/subtitle-files/") &&
        typeof directWavPath === "string";

      if (canTryDirectWavPath) {
        audioRouteFallbackTriedRef.current = true;
        setError(
          `Falha ao renderizar waveform via API (${detail}). Tentando caminho direto do áudio...`,
        );
        setMediaSourceUrl(directWavPath);
        return;
      }

      setError(`Falha ao renderizar waveform: ${detail}`);
    });

    waveSurfer.on("scroll", () => {
      scheduleViewportRefresh();
    });

    return () => {
      cleanupPanSeekHandlers?.();
      cleanupPanSeekHandlers = null;
      waveformOverviewDragRef.current = null;
      if (rafViewportUi) cancelAnimationFrame(rafViewportUi);
      scheduleViewportRefreshRef.current = null;
      waveformViewportLastRef.current = null;
      setWaveformViewport(null);
      wrapperResizeObserver?.disconnect();
      wrapperResizeObserver = null;
      setWaveformCueOverlayHostEl(null);
      waveformCueOverlayHostRef.current = null;
      waveSurfer.destroy();
      if (waveSurferRef.current === waveSurfer) {
        waveSurferRef.current = null;
      }
      setWaveformDurationSec(null);
    };
    // `waveformPx` incluído: altura do mount medida por ResizeObserver — deve coincidir com o WaveSurfer.
  }, [
    waveformEnabled,
    localWaveformData,
    bindPanSeekHandlers,
    mediaSourceUrl,
    mediaKind,
    waveformPx,
  ]);
}
