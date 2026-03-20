"use client";

import { useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import type WaveSurfer from "wavesurfer.js";

type UseWaveformCanvasOverlayParams = {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  waveSurferRef: MutableRefObject<WaveSurfer | null>;
  waveformContainerRef: MutableRefObject<HTMLDivElement | null>;
  /** Atualizado no pai a cada frame de playback — evita re-disparar o effect. */
  currentPlaybackMsRef: MutableRefObject<number>;
  waveformDurationSec: number | null;
  waveformViewport: {
    scroll: number;
    maxScroll: number;
    viewW: number;
    totalW: number;
  } | null;
  enabled: boolean;
};

const COLOR_WAVE = [56, 130, 246] as const;
const COLOR_PROGRESS = [147, 197, 253] as const;
const COLOR_PLAYHEAD = [250, 204, 21] as const;

function rgba(c: readonly [number, number, number], a: number) {
  return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
}

function extractPeaksFromWaveSurfer(ws: WaveSurfer): number[] {
  try {
    const decoded = ws.getDecodedData?.();
    if (!decoded) return [];
    const channel = decoded.getChannelData(0);
    const N = 2000;
    const blockSize = Math.max(1, Math.floor(channel.length / N));
    const peaks: number[] = new Array(N);
    for (let i = 0; i < N; i++) {
      const start = i * blockSize;
      const end = Math.min(start + blockSize, channel.length);
      let max = 0;
      for (let j = start; j < end; j++) {
        const v = Math.abs(channel[j] ?? 0);
        if (v > max) max = v;
      }
      peaks[i] = max;
    }
    const peak = Math.max(...peaks, 0.001);
    return peaks.map((v) => v / peak);
  } catch {
    return [];
  }
}

/**
 * Canvas sobre o WaveSurfer: estilo “Pro bars” azul + playhead.
 * WaveSurfer fica invisível (cores transparentes no lifecycle); seek/scroll/zoom inalterados.
 */
export function useWaveformCanvasOverlay({
  canvasRef,
  waveSurferRef,
  waveformContainerRef,
  currentPlaybackMsRef,
  waveformDurationSec,
  waveformViewport,
  enabled,
}: UseWaveformCanvasOverlayParams) {
  const rafRef = useRef(0);
  const peaksRef = useRef<number[]>([]);

  useEffect(() => {
    if (!enabled) {
      peaksRef.current = [];
      return;
    }
    const ws = waveSurferRef.current;
    if (!ws) return;

    function extractPeaks() {
      const w = waveSurferRef.current;
      if (!w) return;
      peaksRef.current = extractPeaksFromWaveSurfer(w);
    }

    ws.on("decode", extractPeaks);
    ws.on("ready", extractPeaks);
    extractPeaks();

    return () => {
      ws.un("decode", extractPeaks);
      ws.un("ready", extractPeaks);
    };
  }, [enabled, waveSurferRef, waveformDurationSec]);

  useEffect(() => {
    if (!enabled) return;

    let running = true;

    function draw() {
      if (!running) return;

      const canvas = canvasRef.current;
      const container = waveformContainerRef.current;
      if (!canvas || !container) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const dpr = window.devicePixelRatio || 1;
      const rect = container.getBoundingClientRect();
      const W = rect.width * dpr;
      const H = Math.max(1, rect.height * dpr);

      if (canvas.width !== Math.round(W) || canvas.height !== Math.round(H)) {
        canvas.width = Math.round(W);
        canvas.height = Math.round(H);
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const peaks = peaksRef.current;
      const vp = waveformViewport;
      const durSec = waveformDurationSec;

      if (!peaks.length || !vp || !durSec || vp.totalW <= 0) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const midY = H / 2;
      const playMs = currentPlaybackMsRef.current;
      const playRatio = Math.max(0, Math.min(1, playMs / (durSec * 1000)));
      const scrollRatio = vp.scroll / vp.totalW;
      const viewRatio = vp.viewW / vp.totalW;

      const BAR_W = 3 * dpr;
      const GAP_W = 1.5 * dpr;
      const STEP = BAR_W + GAP_W;
      const numBars = Math.ceil(W / STEP);
      const SEG = 14;

      for (let b = 0; b < numBars; b++) {
        const barX = b * STEP;
        const barTimeRatio = scrollRatio + (b / numBars) * viewRatio;
        const isPast = barTimeRatio < playRatio;
        const peakIdx = Math.min(
          peaks.length - 1,
          Math.floor(barTimeRatio * peaks.length),
        );
        const amp = (peaks[peakIdx] ?? 0) * midY * 0.82;
        const segH = amp / SEG;

        for (let s = 0; s < SEG; s++) {
          const sh = Math.max(0, segH - 1 * dpr);
          if (sh < 0.5) continue;
          const intensity = 1 - (s / SEG) * 0.45;
          if (isPast) {
            ctx.fillStyle = rgba(COLOR_PROGRESS, 0.82 * intensity);
          } else {
            ctx.fillStyle = rgba(COLOR_WAVE, 0.45 * intensity);
          }
          const sy = midY - amp + s * segH;
          ctx.fillRect(barX, sy, BAR_W, sh);
        }

        const mirrorAmp = amp * 0.45;
        const mirrorSegH = mirrorAmp / SEG;
        for (let s = 0; s < SEG; s++) {
          const mirrorSH = Math.max(0, mirrorSegH - 1 * dpr);
          if (mirrorSH < 0.5) continue;
          const intensity = 1 - (s / SEG) * 0.45;
          ctx.fillStyle = isPast
            ? rgba(COLOR_PROGRESS, 0.25 * intensity)
            : rgba(COLOR_WAVE, 0.14 * intensity);
          ctx.fillRect(barX, midY + s * mirrorSegH, BAR_W, mirrorSH);
        }
      }

      ctx.strokeStyle = "rgba(255,255,255,0.05)";
      ctx.lineWidth = 0.5 * dpr;
      ctx.beginPath();
      ctx.moveTo(0, midY);
      ctx.lineTo(W, midY);
      ctx.stroke();

      const xPlay =
        ((playRatio - scrollRatio) / Math.max(1e-6, viewRatio)) * W;
      if (xPlay >= 0 && xPlay <= W) {
        ctx.strokeStyle = rgba(COLOR_PLAYHEAD, 0.95);
        ctx.lineWidth = 1 * dpr;
        ctx.beginPath();
        ctx.moveTo(Math.round(xPlay) + 0.5 * dpr, 0);
        ctx.lineTo(Math.round(xPlay) + 0.5 * dpr, H);
        ctx.stroke();
      }

      rafRef.current = requestAnimationFrame(draw);
    }

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      running = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [
    enabled,
    canvasRef,
    waveformContainerRef,
    currentPlaybackMsRef,
    waveformDurationSec,
    waveformViewport,
  ]);
}
