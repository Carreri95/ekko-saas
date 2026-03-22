"use client";

import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { AspectRatio, MediaPreviewPanelProps } from "../types";
import { CPS_CRIT_ABOVE, CPS_WARN_ABOVE } from "../lib/cue-utils";

const RATIOS: Array<{ value: AspectRatio; label: string }> = [
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "1:1", label: "1:1" },
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
  if (containerWidth <= 0 || containerHeight <= 0)
    return { width: 0, height: 0 };
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

function formatTimecode(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, "0");
  return `${String(m).padStart(2, "0")}:${s}`;
}

function formatTimecodeShort(ms: number): string {
  const sec = ms / 1000;
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, "0");
  return `${String(m).padStart(2, "0")}:${s}`;
}

function SubtitleOverlay({ text }: { text: string }) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] box-border w-full min-w-0 max-w-full max-h-[min(42%,calc(100%-12%))] overflow-hidden"
      style={{ padding: "0 8% 8%" }}
    >
      <div className="w-full min-w-0 max-w-full" style={{ textAlign: "center" }}>
        <span
          style={{
            display: "inline",
            background: "rgba(0,0,0,0.82)",
            color: "#ffffff",
            padding: "3px 10px",
            boxDecorationBreak: "clone",
            WebkitBoxDecorationBreak: "clone",
            fontSize: "clamp(11px, 5cqw, 18px)",
            fontWeight: 600,
            lineHeight: 1.65,
            whiteSpace: "pre-line",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            textShadow: "0 1px 3px rgba(0,0,0,1)",
          }}
        >
          {text}
        </span>
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
  currentTimeSec,
  durationSec,
  activeCueInfo,
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

  const progressPct =
    durationSec != null &&
    durationSec > 0 &&
    currentTimeSec != null &&
    Number.isFinite(currentTimeSec)
      ? Math.min(100, (currentTimeSec / durationSec) * 100)
      : 0;

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded border border-[var(--border)] bg-[var(--bg-page)]">
      <div className="flex h-[32px] shrink-0 items-center justify-between border-b border-[#1e1e1e] bg-[#181818] px-[10px]">
        <span className="text-[10px] font-[500] uppercase tracking-[0.08em] text-[#444]">
          Preview
        </span>
        <div className="flex items-center gap-[2px]">
          {RATIOS.map((ratio) => (
            <button
              key={ratio.value}
              type="button"
              className={`rounded-[3px] px-[6px] py-[1px] font-mono text-[10px] transition-colors ${
                aspectRatio === ratio.value
                  ? "bg-[#2a2a2a] text-[#e8e8e8]"
                  : "text-[#383838] hover:text-[#606060]"
              }`}
              onClick={() => onAspectRatioChange(ratio.value)}
            >
              {ratio.label}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={playerHostRef}
        className="relative flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden bg-[#080808]"
      >
        {hasMedia ? (
          <div
            className="relative max-h-full max-w-full min-w-0 overflow-hidden"
            style={playerBoxStyle}
          >
            {isVideo ? (
              <video
                ref={mediaRef as RefObject<HTMLVideoElement>}
                className="absolute inset-0 z-0 h-full w-full object-contain"
                preload="metadata"
                playsInline
                src={mediaSourceUrl!}
                onTimeUpdate={(e) =>
                  onTimeUpdate(e.currentTarget.currentTime)
                }
              />
            ) : (
              <div
                className="absolute inset-0 z-0 bg-[#080808]"
                aria-hidden
              />
            )}

            <div
              className="pointer-events-none absolute inset-0 z-[2]"
              style={{
                margin: "4% 5%",
                border: "1px solid rgba(255,255,255,0.05)",
                borderRadius: 0,
              }}
            />

            {activeSubtitleText ? (
              <SubtitleOverlay text={activeSubtitleText} />
            ) : null}

            {currentTimeSec != null && Number.isFinite(currentTimeSec) ? (
              <div className="pointer-events-none absolute left-[8px] top-[7px] z-[4] font-mono text-[9px] tabular-nums tracking-[0.05em] text-[rgba(255,255,255,0.22)]">
                {formatTimecode(currentTimeSec)}
              </div>
            ) : null}

            {durationSec != null && durationSec > 0 ? (
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-[4] h-[2px] bg-[rgba(255,255,255,0.06)]">
                <div
                  className="h-full bg-[#1D9E75] opacity-60"
                  style={{
                    width: `${progressPct}%`,
                    transition: "none",
                  }}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-[8px]">
            <p className="text-[11px] text-[#333]">Sem mídia carregada</p>
          </div>
        )}
      </div>

      <div className="flex h-[26px] shrink-0 items-center gap-[8px] border-t border-[#1e1e1e] bg-[#141414] px-[10px]">
        {activeCueInfo ? (
          <>
            <div className="h-[5px] w-[5px] shrink-0 rounded-full bg-[#1D9E75]" />
            <span className="font-mono text-[10px] text-[#444]">
              #{activeCueInfo.cueIndex}
            </span>
            <span className="text-[10px] text-[#333]">
              {formatTimecodeShort(activeCueInfo.startMs)} →{" "}
              {formatTimecodeShort(activeCueInfo.endMs)}
            </span>
            <div className="flex-1" />
            <span
              className={`font-mono text-[10px] tabular-nums ${
                activeCueInfo.cps > CPS_CRIT_ABOVE
                  ? "text-[#E24B4A]"
                  : activeCueInfo.cps > CPS_WARN_ABOVE
                    ? "text-[#BA7517]"
                    : "text-[#444]"
              }`}
            >
              {activeCueInfo.cps.toFixed(1)} c/s
            </span>
          </>
        ) : (
          <span className="text-[10px] text-[#333]">—</span>
        )}
      </div>

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
