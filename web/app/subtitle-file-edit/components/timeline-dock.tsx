"use client";

import { createPortal } from "react-dom";
import type { CSSProperties, MutableRefObject, PointerEvent as ReactPointerEvent } from "react";
import { WaveformTimeRuler } from "./waveform-time-ruler";
import { WaveformCueRegionItem } from "./waveform-cue-region-item";
import { WaveformOverview } from "./waveform-overview";
import { WaveformTransportControls } from "./waveform-transport-controls";
import { computeOverviewMetrics } from "../lib/waveform-time";
import type { CueDto } from "../types";

type TimelineDockProps = {
  mediaSourceUrl: string | null;
  mediaKind: "audio" | "video" | null;
  currentPlaybackMs: number;
  canReplaceAudio: boolean;
  onReplaceAudio: () => void;
  waveformViewport: {
    scroll: number;
    maxScroll: number;
    viewW: number;
    totalW: number;
  } | null;
  waveformDurationSec: number | null;
  waveformContainerRef: MutableRefObject<HTMLDivElement | null>;
  isWaveformPanning: boolean;
  waveformCueOverlayHostEl: HTMLElement | null;
  cueWaveformRegions: Array<{
    cue: CueDto;
    leftPx: number;
    widthPx: number;
    hasProblems: boolean;
  }>;
  activeCueTempId: string | null;
  selectedCueTempId: string | null;
  cueEditFocusTempId: string | null;
  waveformEdgeDrag: { tempId: string; edge: "start" | "end" } | null;
  waveformMoveDrag: { tempId: string } | null;
  minGapMs: number;
  formatPlaybackTime: (ms: number) => string;
  onEdgePointerDown: (
    e: ReactPointerEvent<HTMLDivElement>,
    cue: CueDto,
    edge: "start" | "end",
  ) => void;
  onEdgePointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onEdgePointerEnd: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onMovePointerDown: (e: ReactPointerEvent<HTMLDivElement>, cue: CueDto) => void;
  onMovePointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onMovePointerEnd: (e: ReactPointerEvent<HTMLDivElement>) => void;
  setSelectedCueTempId: React.Dispatch<React.SetStateAction<string | null>>;
  setCueEditFocusTempId: React.Dispatch<React.SetStateAction<string | null>>;
  setEditingCueTempId: React.Dispatch<React.SetStateAction<string | null>>;
  cueSingleClickTimerRef: MutableRefObject<number>;
  seekPlaybackFromWaveClientX: (clientX: number) => void;
  focusCueCardInList: (tempId: string) => void;
  onOverviewPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onPlayMedia: () => void;
  onPauseMedia: () => void;
  onResetMediaToStart: () => void;
  waveformPx: number;
  waveformGridStyle: CSSProperties;
};

export function TimelineDock({
  mediaSourceUrl,
  mediaKind,
  currentPlaybackMs,
  canReplaceAudio,
  onReplaceAudio,
  waveformViewport,
  waveformDurationSec,
  waveformContainerRef,
  isWaveformPanning,
  waveformCueOverlayHostEl,
  cueWaveformRegions,
  activeCueTempId,
  selectedCueTempId,
  cueEditFocusTempId,
  waveformEdgeDrag,
  waveformMoveDrag,
  minGapMs,
  formatPlaybackTime,
  onEdgePointerDown,
  onEdgePointerMove,
  onEdgePointerEnd,
  onMovePointerDown,
  onMovePointerMove,
  onMovePointerEnd,
  setSelectedCueTempId,
  setCueEditFocusTempId,
  setEditingCueTempId,
  cueSingleClickTimerRef,
  seekPlaybackFromWaveClientX,
  focusCueCardInList,
  onOverviewPointerDown,
  onPlayMedia,
  onPauseMedia,
  onResetMediaToStart,
  waveformPx,
  waveformGridStyle,
}: TimelineDockProps) {
  const vp = waveformViewport;
  const { thumbWidthPct, thumbLeftPct } = computeOverviewMetrics(vp, waveformDurationSec);

  return (
    <section
      className="editor-timeline-dock-inner editor-review-hub editor-media-dock editor-timing-dock flex h-full min-w-0 flex-col overflow-hidden bg-zinc-950"
      aria-label="Linha do tempo: áudio e forma de onda"
    >
      {mediaSourceUrl ? (
        <div className="editor-media-stage editor-media-stage--dock mt-0 flex h-full min-w-0 flex-col overflow-hidden px-1 pb-1 pt-0.5">
          {mediaKind === "audio" ? (
            <>
              <div className="editor-waveform-lane flex h-full min-w-0 flex-col">
                <div className="editor-waveform-zoom-bar mb-0 flex h-10 min-h-0 min-w-0 items-center gap-0 border-b border-zinc-800/70 bg-zinc-900/80 px-2.5">
                  <span className="font-mono text-[24px] leading-none tracking-tight text-zinc-100 tabular-nums">
                    {formatPlaybackTime(currentPlaybackMs)}
                  </span>
                  <div className="mx-3 h-6 w-px bg-zinc-800/90" />
                  <div className="flex-1" />
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={onReplaceAudio}
                    disabled={!canReplaceAudio}
                    className="inline-flex h-7 items-center rounded border border-zinc-700/90 bg-zinc-900/80 px-2.5 text-[11px] text-zinc-300 hover:border-zinc-500 hover:bg-zinc-800/90 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-45"
                    title="Substituir apenas o áudio, mantendo as cues"
                  >
                    Substituir áudio
                  </button>
                </div>
                <WaveformTimeRuler viewport={waveformViewport} durationSec={waveformDurationSec} />
                <div className="editor-waveform-shell editor-waveform-shell--primary editor-waveform-shell--hero h-[220px] min-w-0 shrink-0 overflow-hidden">
                  <div className="editor-waveform-stack editor-waveform-stack--hero relative min-h-0 w-full min-w-0 max-w-full">
                    <div
                      ref={waveformContainerRef}
                      className={`editor-waveform-mount editor-waveform-mount--timeline relative z-0 h-full w-full min-w-0 max-w-full overflow-hidden rounded-none ${
                        isWaveformPanning ? "editor-waveform-mount--panning" : ""
                      }`}
                    />
                    {waveformCueOverlayHostEl &&
                    waveformDurationSec != null &&
                    cueWaveformRegions.length > 0
                      ? createPortal(
                          <div
                            className="editor-waveform-cue-regions"
                            style={{ height: waveformPx, ...waveformGridStyle }}
                          >
                            {cueWaveformRegions.map(({ cue, leftPx, widthPx, hasProblems }) => {
                              const isPlaybackHere = activeCueTempId === cue.tempId;
                              const isSelectedHere = selectedCueTempId === cue.tempId;
                              const isEditFocusHere = cueEditFocusTempId === cue.tempId;
                              const dragRef = waveformEdgeDrag;
                              const isEdgeDragging = dragRef?.tempId === cue.tempId;
                              const isMoveDragging = waveformMoveDrag?.tempId === cue.tempId;
                              const dragEdge = isEdgeDragging ? dragRef?.edge ?? null : null;
                              return (
                                <WaveformCueRegionItem
                                  key={cue.tempId}
                                  cue={cue}
                                  leftPx={leftPx}
                                  widthPx={widthPx}
                                  hasProblems={hasProblems}
                                  isPlaybackHere={isPlaybackHere}
                                  isSelectedHere={isSelectedHere}
                                  isEditFocusHere={isEditFocusHere}
                                  isEdgeDragging={isEdgeDragging}
                                  isMoveDragging={isMoveDragging}
                                  dragEdge={dragEdge}
                                  waveformDurationSec={waveformDurationSec}
                                  minGapMs={minGapMs}
                                  formatPlaybackTime={formatPlaybackTime}
                                  onEdgePointerDown={onEdgePointerDown}
                                  onEdgePointerMove={onEdgePointerMove}
                                  onEdgePointerEnd={onEdgePointerEnd}
                                  onMovePointerDown={onMovePointerDown}
                                  onMovePointerMove={onMovePointerMove}
                                  onMovePointerEnd={onMovePointerEnd}
                                  onBodyClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const clickX = e.clientX;
                                    setSelectedCueTempId(cue.tempId);
                                    setCueEditFocusTempId(null);
                                    setEditingCueTempId((prev) => (prev ? cue.tempId : prev));
                                    if (cueSingleClickTimerRef.current) {
                                      window.clearTimeout(cueSingleClickTimerRef.current);
                                    }
                                    cueSingleClickTimerRef.current = window.setTimeout(() => {
                                      cueSingleClickTimerRef.current = 0;
                                      seekPlaybackFromWaveClientX(clickX);
                                    }, 190);
                                  }}
                                  onBodyDoubleClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    const clickX = e.clientX;
                                    if (cueSingleClickTimerRef.current) {
                                      window.clearTimeout(cueSingleClickTimerRef.current);
                                      cueSingleClickTimerRef.current = 0;
                                    }
                                    setSelectedCueTempId(cue.tempId);
                                    setCueEditFocusTempId(cue.tempId);
                                    setEditingCueTempId(cue.tempId);
                                    seekPlaybackFromWaveClientX(clickX);
                                    focusCueCardInList(cue.tempId);
                                  }}
                                />
                              );
                            })}
                          </div>,
                          waveformCueOverlayHostEl,
                        )
                      : null}
                  </div>
                  <WaveformOverview
                    viewport={vp}
                    thumbLeftPct={thumbLeftPct}
                    thumbWidthPct={thumbWidthPct}
                    onPointerDown={onOverviewPointerDown}
                  />
                </div>
                <div className="h-9 shrink-0 border-t border-zinc-800/60">
                  <WaveformTransportControls onPlay={onPlayMedia} onPause={onPauseMedia} onReset={onResetMediaToStart} />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="editor-waveform-lane flex h-full min-w-0 flex-col">
                <div className="editor-waveform-shell editor-waveform-shell--primary editor-waveform-shell--hero h-[220px] min-w-0 shrink-0 overflow-hidden">
                  <div className="editor-waveform-stack editor-waveform-stack--hero relative min-h-0 w-full min-w-0">
                    <div
                      className="editor-waveform-mount editor-waveform-mount--timeline editor-waveform-mount--video-placeholder relative z-0 flex w-full min-w-0 flex-col items-center justify-center overflow-hidden rounded-none px-2 text-center"
                      style={{ minHeight: waveformPx }}
                      role="region"
                      aria-label="Área da timeline — carregue áudio para ver a forma de onda"
                    >
                      <p className="text-[11px] text-zinc-500">
                        Sem waveform — use um ficheiro de áudio (WAV/MP3) no painel lateral.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="h-[36px] shrink-0 border-t border-zinc-800/70 bg-[#0e0e0e]" />
                <div className="h-9 shrink-0 border-t border-zinc-800/60">
                  <WaveformTransportControls onPlay={onPlayMedia} onPause={onPauseMedia} onReset={onResetMediaToStart} />
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="editor-timing-empty mt-0 flex h-full min-w-0 shrink-0 flex-col items-center justify-center border-t border-dashed border-zinc-800/70 bg-zinc-950/80 px-3 py-4 text-center">
          <p className="text-[11px] text-zinc-500">
            Sem mídia — largue áudio ou vídeo no painel lateral (ou URL) para timeline e playhead.
          </p>
        </div>
      )}
    </section>
  );
}
