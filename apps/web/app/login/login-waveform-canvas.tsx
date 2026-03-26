"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

const BAR_W = 2;
const GAP = 1;
const STEP = BAR_W + GAP;
const SEED = 0x9e3779b9;
const T_STEP = 0.012;

function mulberry32(init: number) {
  let state = init;
  return function next() {
    let t = (state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function parseCssColorToRgb(css: string): [number, number, number] {
  const s = css.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    const full =
      hex.length === 3
        ? hex
            .split("")
            .map((c) => c + c)
            .join("")
        : hex;
    const n = parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (m) {
    return [Number(m[1]), Number(m[2]), Number(m[3])];
  }
  return [29, 158, 117];
}

type BarData = {
  base: number[];
  phase: number[];
  speed: number[];
};

function buildBarData(nBars: number): BarData {
  const rand = mulberry32(SEED);
  const base: number[] = [];
  const phase: number[] = [];
  const speed: number[] = [];
  for (let i = 0; i < nBars; i++) {
    const wave = Math.sin(i * 0.065 + rand() * 1.8) * 0.5 + 0.5;
    const noise = rand();
    const rel = Math.min(1, Math.max(0, wave * 0.62 + noise * 0.38));
    base.push(rel);
    phase.push(rand() * Math.PI * 2);
    speed.push(0.5 + rand() * 2.2);
  }
  return { base, phase, speed };
}

type Props = {
  className?: string;
};

export function LoginWaveformCanvas({ className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const barDataRef = useRef<BarData | null>(null);
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const tRef = useRef(0);

  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const syncSize = () => {
      const wCss = parent.clientWidth;
      const hCss = parent.clientHeight;
      if (wCss < 8 || hCss < 8) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      sizeRef.current = { w: wCss, h: hCss, dpr };
      canvas.width = Math.floor(wCss * dpr);
      canvas.height = Math.floor(hCss * dpr);
      canvas.style.width = `${wCss}px`;
      canvas.style.height = `${hCss}px`;
      const nBars = Math.ceil(wCss / STEP);
      barDataRef.current = buildBarData(nBars);
    };

    syncSize();
    const ro = new ResizeObserver(() => {
      syncSize();
    });
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const draw = (t: number) => {
      const { w, h, dpr } = sizeRef.current;
      if (w < 8 || h < 8) return;
      const data = barDataRef.current;
      if (!data) return;

      const root = document.documentElement;
      const accent =
        getComputedStyle(root).getPropertyValue("--accent").trim() || "#1d9e75";
      const [r, g, b] = parseCssColorToRgb(accent);

      const midY = h / 2;
      const maxHalf = Math.min(h * 0.38, 200);
      const nBars = data.base.length;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      for (let i = 0; i < nBars; i++) {
        const x = i * STEP;
        let v: number;
        if (reduced) {
          v = data.base[i];
        } else {
          v = Math.min(
            1,
            Math.max(
              0,
              data.base[i] +
                Math.sin(t * data.speed[i] + data.phase[i]) * 0.18,
            ),
          );
        }
        const halfH = 6 + v * (maxHalf - 6);
        const alpha = 0.05 + v * 0.18;
        const top = midY - halfH;
        const barH = halfH * 2;

        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fillRect(x, top, BAR_W, barH);
      }
    };

    if (reduced) {
      tRef.current = 0;
      draw(0);
      return;
    }

    let rafId = 0;
    const tick = () => {
      tRef.current += T_STEP;
      draw(tRef.current);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden />;
}
