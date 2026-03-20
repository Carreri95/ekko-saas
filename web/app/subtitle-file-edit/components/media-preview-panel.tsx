"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { AspectRatio } from "../types";

type MediaPreviewPanelProps = {
  mediaSourceUrl: string | null;
  mediaKind: "audio" | "video" | null;
  mediaRef: RefObject<HTMLAudioElement | HTMLVideoElement | null>;
  activeSubtitleText: string;
  onTimeUpdate: (currentTimeSec: number) => void;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
};

const RATIOS: Array<{ value: AspectRatio; label: string; icon: string }> = [
  { value: "16:9", label: "16:9", icon: "▬" },
  { value: "9:16", label: "9:16", icon: "▮" },
  { value: "1:1", label: "1:1", icon: "■" },
];

function getPlayerDimensions(
  containerWidth: number,
  containerHeight: number,
  ratio: AspectRatio,
) {
  const ratioMap: Record<AspectRatio, number> = {
    "16:9": 16 / 9,
    "9:16": 9 / 16,
    "1:1": 1,
  };
  const r = ratioMap[ratio];
  if (containerWidth <= 0 || containerHeight <= 0) {
    return { width: 0, height: 0 };
  }
  if (ratio === "9:16") {
    const height = Math.min(containerHeight * 0.92, containerWidth / r);
    const width = height * r;
    return { width, height };
  }
  if (ratio === "1:1") {
    const side = Math.min(containerWidth * 0.9, containerHeight * 0.92);
    return { width: side, height: side };
  }
  let width = containerWidth * 0.96;
  let height = width / r;
  if (height > containerHeight * 0.92) {
    height = containerHeight * 0.92;
    width = height * r;
  }
  return { width, height };
}

export function MediaPreviewPanel({
  mediaSourceUrl,
  mediaKind,
  mediaRef,
  activeSubtitleText,
  onTimeUpdate,
  aspectRatio,
  onAspectRatioChange,
}: MediaPreviewPanelProps) {
  const playerHostRef = useRef<HTMLDivElement | null>(null);
  const [playerDims, setPlayerDims] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const host = playerHostRef.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    const applyDims = () => {
      const rect = host.getBoundingClientRect();
      setPlayerDims(getPlayerDimensions(rect.width, rect.height, aspectRatio));
    };
    applyDims();
    const observer = new ResizeObserver(() => {
      applyDims();
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, [aspectRatio]);

  const playerBoxStyle = useMemo(
    () => ({
      width: `${Math.max(0, Math.floor(playerDims.width))}px`,
      height: `${Math.max(0, Math.floor(playerDims.height))}px`,
      transition: "width 0.25s ease, height 0.25s ease",
    }),
    [playerDims],
  );

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded border border-zinc-800/90 bg-zinc-950">
      <div className="shrink-0 px-2 py-1 flex items-center justify-end gap-1">
        {RATIOS.map((ratio) => (
          <button
            key={ratio.value}
            type="button"
            className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-mono transition-colors ${
              aspectRatio === ratio.value
                ? "border-blue-500/70 bg-blue-500/15 text-blue-200"
                : "border-zinc-700/80 bg-transparent text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
            }`}
            onClick={() => onAspectRatioChange(ratio.value)}
            title={ratio.label}
          >
            <span className="text-[12px]">{ratio.icon}</span>
            {ratio.label}
          </button>
        ))}
      </div>
      <div
        ref={playerHostRef}
        className="relative flex min-h-0 flex-1 w-full items-center justify-center overflow-hidden rounded-none border-y border-zinc-800 bg-black"
      >
        <div
          className="relative max-w-full max-h-full overflow-hidden border border-zinc-700/80 bg-black"
          style={playerBoxStyle}
        >
          {mediaSourceUrl && mediaKind === "video" ? (
            <video
              ref={mediaRef as RefObject<HTMLVideoElement>}
              className="h-full w-full object-contain"
              preload="metadata"
              playsInline
              src={mediaSourceUrl}
              onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
            />
          ) : (
            <div className="h-full w-full bg-black" />
          )}
          <div className="pointer-events-none absolute inset-x-2 bottom-2 whitespace-pre-line rounded bg-black/55 px-2 py-1 text-center text-[11px] leading-tight text-zinc-100">
            {activeSubtitleText || "Sem legenda ativa no momento"}
          </div>
        </div>
      </div>
      {mediaSourceUrl && mediaKind === "audio" ? (
        <audio
          ref={mediaRef as RefObject<HTMLAudioElement>}
          preload="metadata"
          src={mediaSourceUrl}
          onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
          className="sr-only"
        />
      ) : null}
    </section>
  );
}
