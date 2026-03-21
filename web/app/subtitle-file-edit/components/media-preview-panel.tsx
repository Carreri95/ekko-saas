"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import type { AspectRatio, MediaPreviewPanelProps } from "../types";

const RATIOS: Array<{ value: AspectRatio; label: string }> = [
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "1:1",  label: "1:1"  },
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
  if (containerWidth <= 0 || containerHeight <= 0) return { width: 0, height: 0 };
  if (ratio === "9:16") {
    const height = Math.min(containerHeight * 0.92, containerWidth / r);
    return { width: height * r, height };
  }
  if (ratio === "1:1") {
    const side = Math.min(containerWidth * 0.88, containerHeight * 0.88);
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

function AudioOnlyScreen({ text }: { text: string }) {
  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ background: "linear-gradient(180deg, #0a0a0a 0%, #111 100%)" }}
    >
      {/* Subtle grid suggesting a screen surface */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 31px, rgba(255,255,255,0.6) 31px, rgba(255,255,255,0.6) 32px), repeating-linear-gradient(90deg, transparent, transparent 31px, rgba(255,255,255,0.6) 31px, rgba(255,255,255,0.6) 32px)",
        }}
      />

      {/* Waveform decoration — very faint, center-top area */}
      <div className="absolute inset-0 flex flex-col items-center justify-center opacity-[0.06]">
        <div className="flex items-end gap-[2px]">
          {[3, 5, 9, 6, 11, 4, 8, 6, 10, 5, 7, 4, 9, 6, 4].map((h, i) => (
            <div
              key={i}
              className="w-[3px] rounded-sm bg-white"
              style={{ height: `${h * 4}px` }}
            />
          ))}
        </div>
      </div>

      {/* Subtitle positioned at bottom — exactly like real broadcast */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 px-[6%] pb-[8%]">
        {text ? (
          <div className="mx-auto max-w-full text-center">
            <p
              className="inline whitespace-pre-line break-words bg-black/85 px-[0.4em] py-[0.15em] font-medium text-white"
              style={{
                fontSize: "clamp(13px, 5.5cqw, 22px)",
                lineHeight: 1.45,
                boxDecorationBreak: "clone",
                WebkitBoxDecorationBreak: "clone",
                textShadow: "0 1px 3px rgba(0,0,0,1)",
              }}
            >
              {text}
            </p>
          </div>
        ) : (
          /* Placeholder bars when no active cue */
          <div className="flex flex-col items-center gap-[5px] opacity-[0.12]">
            <div className="h-[5px] w-3/4 rounded-sm bg-white" />
            <div className="h-[5px] w-1/2 rounded-sm bg-white" />
          </div>
        )}
      </div>
    </div>
  );
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
    const observer = new ResizeObserver(applyDims);
    observer.observe(host);
    return () => observer.disconnect();
  }, [aspectRatio]);

  const playerBoxStyle = useMemo(
    () => ({
      width: `${Math.max(0, Math.floor(playerDims.width))}px`,
      height: `${Math.max(0, Math.floor(playerDims.height))}px`,
      transition: "width 0.2s ease, height 0.2s ease",
      containerType: "inline-size" as const,
    }),
    [playerDims],
  );

  const isAudioOnly = Boolean(mediaSourceUrl && mediaKind === "audio");
  const isVideo = Boolean(mediaSourceUrl && mediaKind === "video");
  const hasMedia = isAudioOnly || isVideo;

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded border border-zinc-800/80 bg-zinc-950">
      {/* Header */}
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-zinc-800/70 bg-zinc-900/60 px-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-600">
          preview
        </span>
        <div className="flex items-center gap-0.5">
          {RATIOS.map((ratio) => (
            <button
              key={ratio.value}
              type="button"
              className={`h-5 rounded px-2 text-[10px] font-mono transition-colors ${
                aspectRatio === ratio.value
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
              onClick={() => onAspectRatioChange(ratio.value)}
            >
              {ratio.label}
            </button>
          ))}
        </div>
      </div>

      {/* Player host */}
      <div
        ref={playerHostRef}
        className="relative flex min-h-0 flex-1 w-full items-center justify-center overflow-hidden bg-[#0d0d0d]"
      >
        {hasMedia ? (
          /* Proportional box rendered for BOTH video and audio */
          <div
            className="relative max-w-full max-h-full overflow-hidden"
            style={playerBoxStyle}
          >
            {isVideo ? (
              <>
                <video
                  ref={mediaRef as RefObject<HTMLVideoElement>}
                  className="h-full w-full object-contain"
                  preload="metadata"
                  playsInline
                  src={mediaSourceUrl!}
                  onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
                />
                {activeSubtitleText ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 bottom-0 px-[6%] pb-[8%] text-center"
                  >
                    <p
                      className="inline whitespace-pre-line break-words bg-black/85 px-[0.4em] py-[0.15em] font-medium text-white"
                      style={{
                        fontSize: "clamp(13px, 5.5cqw, 22px)",
                        lineHeight: 1.45,
                        boxDecorationBreak: "clone",
                        WebkitBoxDecorationBreak: "clone",
                        textShadow: "0 1px 3px rgba(0,0,0,1)",
                      }}
                    >
                      {activeSubtitleText}
                    </p>
                  </div>
                ) : null}
              </>
            ) : (
              <AudioOnlyScreen text={activeSubtitleText} />
            )}
          </div>
        ) : (
          /* No media loaded */
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex items-end gap-[2px] opacity-10">
              {[2, 4, 6, 5, 7, 3, 6, 4, 5, 3].map((h, i) => (
                <div key={i} className="w-1 rounded-sm bg-zinc-400" style={{ height: `${h * 3}px` }} />
              ))}
            </div>
            <p className="text-[11px] text-zinc-700">Sem mídia carregada</p>
          </div>
        )}
      </div>

      {/* Hidden audio element */}
      {isAudioOnly ? (
        <audio
          ref={mediaRef as RefObject<HTMLAudioElement>}
          preload="metadata"
          src={mediaSourceUrl!}
          onTimeUpdate={(e) => onTimeUpdate(e.currentTarget.currentTime)}
          className="sr-only"
        />
      ) : null}
    </section>
  );
}
