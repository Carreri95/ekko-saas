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
  setWaveformDurationSec,
  setWaveformCueOverlayHostEl,
  setWaveformViewport,
  setError,
  setMediaSourceUrl,
  seekPlaybackToTimeSec,
  logBrowserError,
  injectWaveformCueShadowStyles,
}: UseWaveformLifecycleParams): void {
  const wavPathRef = useRef(wavPath);
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

  function isAbortLikeWaveError(detail: string): boolean {
    const d = detail.toLowerCase();
    return d.includes("abort") || d.includes("aborted");
  }

  function summarizeMediaSource(url: string | null): string {
    if (!url) return "null";
    if (url.startsWith("blob:")) return `blob:${url.slice(5, 45)}...`;
    if (url.startsWith("data:")) return `data:${url.slice(5, 40)}...`;
    return url.length > 120 ? `${url.slice(0, 120)}...` : url;
  }

  useEffect(() => {
    wavPathRef.current = wavPath;
    seekPlaybackRef.current = seekPlaybackToTimeSec;
    logErrorRef.current = logBrowserError;
  }, [wavPath, seekPlaybackToTimeSec, logBrowserError]);

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

    setWaveformDurationSec(null);
    setWaveformCueOverlayHostEl(null);
    waveformCueOverlayHostRef.current = null;

    if (waveSurferRef.current) {
      waveSurferRef.current.destroy();
      waveSurferRef.current = null;
    }

    const mediaEl = mediaElementRef.current;

    const usingExternalMediaElement = Boolean(mediaEl && mediaKind === "audio");

    // Garante que o elemento de mídia esteja sincronizado antes de criar o WaveSurfer.
    // Em alguns navegadores, criar a instância durante a troca de URL pode disparar
    // abort/fetch race se o src ainda não foi aplicado no elemento.
    if (usingExternalMediaElement && mediaEl) {
      // Evita reiniciar o pipeline de decode quando o src já está aplicado:
      // chamar load() sem troca de src aborta o fetch atual em alguns browsers.
      if (mediaEl.src !== mediaSourceUrl) {
        mediaEl.src = mediaSourceUrl;
        mediaEl.load();
      }
    }

    let detachMediaDebugListeners: (() => void) | null = null;
    if (usingExternalMediaElement && mediaEl) {
      const onMediaError = () => {
        const err = mediaEl.error;
        const code =
          err?.code === MediaError.MEDIA_ERR_ABORTED
            ? "MEDIA_ERR_ABORTED"
            : err?.code === MediaError.MEDIA_ERR_NETWORK
              ? "MEDIA_ERR_NETWORK"
              : err?.code === MediaError.MEDIA_ERR_DECODE
                ? "MEDIA_ERR_DECODE"
                : err?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED
                  ? "MEDIA_ERR_SRC_NOT_SUPPORTED"
                  : "MEDIA_ERR_UNKNOWN";
        logErrorRef.current("audio element error", {
          code,
          message: err?.message ?? null,
          mediaSourceUrl: summarizeMediaSource(mediaSourceUrl),
          wavPath: wavPathRef.current,
          canPlayWav: mediaEl.canPlayType("audio/wav"),
          canPlayPcm: mediaEl.canPlayType("audio/wav; codecs=1"),
          readyState: mediaEl.readyState,
          networkState: mediaEl.networkState,
        });
      };
      const onCanPlay = () => {
        setError(null);
      };
      mediaEl.addEventListener("error", onMediaError);
      mediaEl.addEventListener("canplay", onCanPlay);
      detachMediaDebugListeners = () => {
        mediaEl.removeEventListener("error", onMediaError);
        mediaEl.removeEventListener("canplay", onCanPlay);
      };
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
      ...(usingExternalMediaElement && mediaEl ? { media: mediaEl } : {}),
    });

    waveSurferRef.current = waveSurfer;

    if (!useLocalWaveformData && !usingExternalMediaElement) {
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
      if (isAbortLikeWaveError(detail)) {
        // Em dev (StrictMode/HMR), o WaveSurfer pode abortar um load intermediário
        // durante remount/cleanup do efeito. Não tratar como erro fatal de UI.
        return;
      }
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
      // Não fazer fallback para `wavPath` (/uploads/media/...): esse caminho só funciona se o
      // ficheiro existir em `apps/web/public`, enquanto a fonte correcta na arquitectura actual
      // é sempre GET /api/subtitle-files/:id/audio (BFF → apps/api, leitura no disco/storage).
      // Trocar a URL recria o WaveSurfer, aborta o pedido anterior ("signal is aborted") e mascara
      // o erro real da rota de áudio.
      setError(
        `Falha ao renderizar waveform: ${detail}. Confirme que GET /api/subtitle-files/.../audio devolve 200 (API em :4000, BFF no Next). wavPath na BD: ${wavPathRef.current ?? "—"}`,
      );
    });

    waveSurfer.on("scroll", () => {
      scheduleViewportRefresh();
    });

    return () => {
      detachMediaDebugListeners?.();
      detachMediaDebugListeners = null;
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
  }, [
    waveformEnabled,
    localWaveformData,
    bindPanSeekHandlers,
    mediaSourceUrl,
    mediaKind,
  ]);

  useEffect(() => {
    const ws = waveSurferRef.current;
    if (!ws) return;
    try {
      ws.setOptions({ height: waveformPx });
    } catch {
      // sem impacto funcional: apenas evita crash em ambientes onde setOptions falhar.
    }
  }, [waveformPx, waveSurferRef]);
}
