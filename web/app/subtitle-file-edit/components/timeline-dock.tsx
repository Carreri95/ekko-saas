"use client";

import { createPortal } from "react-dom";
import type {
  CSSProperties,
  MutableRefObject,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
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
  waveformViewport: {
    scroll: number;
    maxScroll: number;
    viewW: number;
    totalW: number;
  } | null;
  waveformDurationSec: number | null;
  waveformContainerRef: MutableRefObject<HTMLDivElement | null>;
  waveformCanvasOverlayRef: MutableRefObject<HTMLCanvasElement | null>;
  cueCreatePreviewRect: { leftPx: number; widthPx: number } | null;
  onWaveformShellPointerDownCapture: (
    e: ReactPointerEvent<HTMLDivElement>,
  ) => void;
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
  onMovePointerDown: (
    e: ReactPointerEvent<HTMLElement>,
    cue: CueDto,
  ) => void;
  onMovePointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onMovePointerEnd: (e: ReactPointerEvent<HTMLElement>) => void;
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
  onCueContextMenu: (e: MouseEvent, cue: CueDto) => void;
  formatToolbarTime: (ms: number) => string;
  playbackRate: number;
  speedSteps: readonly number[];
  onPlaybackRateChange: (rate: number) => void;
};

export function TimelineDock({
  mediaSourceUrl,
  mediaKind,
  currentPlaybackMs,
  waveformViewport,
  waveformDurationSec,
  waveformContainerRef,
  waveformCanvasOverlayRef,
  cueCreatePreviewRect,
  onWaveformShellPointerDownCapture,
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
  onCueContextMenu,
  formatToolbarTime,
  playbackRate,
  speedSteps,
  onPlaybackRateChange,
}: TimelineDockProps) {
  const vp = waveformViewport;
  const { thumbWidthPct, thumbLeftPct } = computeOverviewMetrics(
    vp,
    waveformDurationSec,
  );

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
                <div className="flex h-10 shrink-0 items-center gap-3 border-b border-zinc-800/70 bg-zinc-900/80 px-3">
                  <span className="font-mono text-[20px] font-medium leading-none tabular-nums text-zinc-100">
                    {formatToolbarTime(currentPlaybackMs)}
                  </span>

                  <div className="h-5 w-px bg-zinc-800" aria-hidden />

                  <div className="relative">
                    <select
                      value={playbackRate}
                      onChange={(e) =>
                        onPlaybackRateChange(Number.parseFloat(e.target.value))
                      }
                      className={`h-6 rounded-sm border bg-zinc-900 px-2 font-mono text-[11px] outline-none hover:border-zinc-600 focus:border-zinc-500 ${
                        playbackRate !== 1.0
                          ? "border-amber-700/60 text-amber-300"
                          : "border-zinc-800 text-zinc-400"
                      }`}
                      title="Velocidade de reprodução"
                    >
                      {speedSteps.map((rate) => (
                        <option key={rate} value={rate}>
                          {rate}×
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <WaveformTimeRuler
                  viewport={waveformViewport}
                  durationSec={waveformDurationSec}
                />
                <div className="editor-waveform-shell editor-waveform-shell--primary editor-waveform-shell--hero h-[220px] min-w-0 shrink-0 overflow-hidden">
                  <div className="editor-waveform-stack editor-waveform-stack--hero relative min-h-0 w-full min-w-0 max-w-full">
                    <div
                      className="relative h-full w-full min-h-0 touch-none"
                      style={{ touchAction: "none" }}
                      onPointerDownCapture={onWaveformShellPointerDownCapture}
                    >
                      <div
                        ref={waveformContainerRef}
                        className="editor-waveform-mount editor-waveform-mount--timeline relative z-0 h-full w-full min-w-0 max-w-full overflow-hidden rounded-none"
                        style={{ paddingTop: "10px", paddingBottom: "10px" }}
                      />
                      <canvas
                        ref={waveformCanvasOverlayRef}
                        aria-hidden
                        className="pointer-events-none absolute inset-0 z-[1]"
                      />
                      {cueCreatePreviewRect &&
                      vp != null &&
                      vp.totalW > 0 ? (
                        <div
                          className="pointer-events-none absolute inset-0 z-[4] overflow-hidden"
                          aria-hidden
                        >
                          <div
                            className="absolute"
                            style={{
                              left: -vp.scroll,
                              width: vp.totalW,
                              top: 10,
                              height: waveformPx,
                            }}
                          >
                            <div
                              style={{
                                position: "absolute",
                                left: cueCreatePreviewRect.leftPx,
                                width: cueCreatePreviewRect.widthPx,
                                top: 0,
                                height: "100%",
                                background: "rgba(250, 204, 21, 0.15)",
                                border: "1px dashed rgba(250, 204, 21, 0.6)",
                                boxSizing: "border-box",
                              }}
                            />
                          </div>
                        </div>
                      ) : null}
                    </div>
                    {waveformCueOverlayHostEl &&
                    waveformDurationSec != null &&
                    cueWaveformRegions.length > 0
                      ? createPortal(
                          <div
                            className="editor-waveform-cue-regions"
                            style={{ height: waveformPx, ...waveformGridStyle }}
                          >
                            {cueWaveformRegions.map(
                              ({ cue, leftPx, widthPx, hasProblems }) => {
                                const isPlaybackHere =
                                  activeCueTempId === cue.tempId;
                                const isSelectedHere =
                                  selectedCueTempId === cue.tempId;
                                const isEditFocusHere =
                                  cueEditFocusTempId === cue.tempId;
                                const dragRef = waveformEdgeDrag;
                                const isEdgeDragging =
                                  dragRef?.tempId === cue.tempId;
                                const isMoveDragging =
                                  waveformMoveDrag?.tempId === cue.tempId;
                                const dragEdge = isEdgeDragging
                                  ? (dragRef?.edge ?? null)
                                  : null;
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
                                      seekPlaybackFromWaveClientX(e.clientX);
                                      setSelectedCueTempId(cue.tempId);
                                      setCueEditFocusTempId(null);
                                      // Um clique só seleciona e faz seek — não abre nem troca o editor.
                                      // Duplo clique é que entra em modo edição (onBodyDoubleClick).
                                      setEditingCueTempId((prev) =>
                                        prev != null && prev !== cue.tempId
                                          ? null
                                          : prev,
                                      );
                                    }}
                                    onBodyDoubleClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      seekPlaybackFromWaveClientX(e.clientX);
                                      if (cueSingleClickTimerRef.current) {
                                        window.clearTimeout(
                                          cueSingleClickTimerRef.current,
                                        );
                                        cueSingleClickTimerRef.current = 0;
                                      }
                                      setSelectedCueTempId(cue.tempId);
                                      setCueEditFocusTempId(cue.tempId);
                                      setEditingCueTempId(cue.tempId);
                                      focusCueCardInList(cue.tempId);
                                    }}
                                    onCueContextMenu={onCueContextMenu}
                                  />
                                );
                              },
                            )}
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
                <div className="h-[48px] shrink-0 border-t border-zinc-800/60">
                  <WaveformTransportControls
                    onPlay={onPlayMedia}
                    onPause={onPauseMedia}
                    onReset={onResetMediaToStart}
                    currentPlaybackMs={currentPlaybackMs}
                    durationMs={
                      waveformDurationSec != null
                        ? waveformDurationSec * 1000
                        : null
                    }
                  />
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
                        Sem waveform — use um ficheiro de áudio (WAV/MP3) no
                        painel lateral.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="h-[36px] shrink-0 border-t border-zinc-800/70 bg-[#0e0e0e]" />
                <div className="h-[48px] shrink-0 border-t border-zinc-800/60">
                  <WaveformTransportControls
                    onPlay={onPlayMedia}
                    onPause={onPauseMedia}
                    onReset={onResetMediaToStart}
                    currentPlaybackMs={currentPlaybackMs}
                    durationMs={
                      waveformDurationSec != null
                        ? waveformDurationSec * 1000
                        : null
                    }
                  />
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="editor-timing-empty mt-0 flex h-full min-w-0 shrink-0 flex-col items-center justify-center border-t border-dashed border-zinc-800/70 bg-zinc-950/80 px-3 py-4 text-center">
          <p className="text-[11px] text-zinc-500">
            Sem mídia — largue áudio ou vídeo no painel lateral (ou URL) para
            timeline e playhead.
          </p>
        </div>
      )}
    </section>
  );
}
