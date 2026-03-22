"use client";

import { createPortal } from "react-dom";
import { WaveformTimeRuler } from "./waveform-time-ruler";
import { WaveformCueRegionItem } from "./waveform-cue-region-item";
import { WaveformOverview } from "./waveform-overview";
import { WaveformTransportControls } from "./waveform-transport-controls";
import { computeOverviewMetrics } from "../lib/waveform-time";
import type { TimelineDockProps } from "../types";

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
      className="editor-timeline-dock-inner editor-review-hub editor-media-dock editor-timing-dock flex h-full min-w-0 flex-col overflow-hidden bg-[var(--bg-page)]"
      aria-label="Linha do tempo: áudio e forma de onda"
    >
      {mediaSourceUrl ? (
        <div className="editor-media-stage editor-media-stage--dock mt-0 flex h-full min-w-0 flex-col overflow-hidden px-3 pb-2 pt-2 sm:px-4">
          {mediaKind === "audio" ? (
            <>
              <div className="editor-waveform-lane flex h-full min-w-0 flex-col">
                <WaveformTimeRuler
                  viewport={waveformViewport}
                  durationSec={waveformDurationSec}
                />
                <div className="editor-waveform-shell editor-waveform-shell--primary editor-waveform-shell--hero min-h-0 min-w-0 flex-1 shrink overflow-hidden">
                  <div className="editor-waveform-stack editor-waveform-stack--hero relative h-full min-h-0 w-full min-w-0 max-w-full">
                    <div
                      className="relative h-full w-full min-h-0 touch-none"
                      style={{ touchAction: "none" }}
                      onPointerDownCapture={onWaveformShellPointerDownCapture}
                    >
                      <div
                        ref={waveformContainerRef}
                        className="editor-waveform-mount editor-waveform-mount--timeline relative z-0 h-full w-full min-w-0 max-w-full overflow-hidden rounded-none"
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
                              top: 0,
                              height: "100%",
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
                            style={waveformGridStyle}
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
                <div className="h-[42px] shrink-0 overflow-hidden">
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
                    playbackRate={playbackRate}
                    speedSteps={speedSteps}
                    onPlaybackRateChange={onPlaybackRateChange}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="editor-waveform-lane flex h-full min-w-0 flex-col">
                <div className="editor-waveform-shell editor-waveform-shell--primary editor-waveform-shell--hero min-h-0 min-w-0 flex-1 shrink overflow-hidden">
                  <div className="editor-waveform-stack editor-waveform-stack--hero relative h-full min-h-0 w-full min-w-0">
                    <div
                      className="editor-waveform-mount editor-waveform-mount--timeline editor-waveform-mount--video-placeholder relative z-0 flex w-full min-w-0 flex-col items-center justify-center overflow-hidden rounded-none px-2 text-center"
                      style={{ minHeight: 200 }}
                      role="region"
                      aria-label="Área da timeline — carregue áudio para ver a forma de onda"
                    >
                      <p className="text-[11px] text-[var(--text-muted)]">
                        Sem waveform — use um ficheiro de áudio (WAV/MP3) no
                        painel lateral.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="h-[36px] shrink-0 border-t border-[var(--border)] bg-[var(--bg-page)]" />
                <div className="h-[42px] shrink-0 overflow-hidden">
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
                    playbackRate={playbackRate}
                    speedSteps={speedSteps}
                    onPlaybackRateChange={onPlaybackRateChange}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="editor-timing-empty mt-0 flex h-full min-w-0 shrink-0 flex-col items-center justify-center border-t border-dashed border-[var(--border)] bg-[var(--bg-page)] px-3 py-4 text-center">
          <p className="text-[11px] text-[var(--text-muted)]">
            Sem mídia — largue áudio ou vídeo no painel lateral (ou URL) para
            timeline e playhead.
          </p>
        </div>
      )}
    </section>
  );
}
