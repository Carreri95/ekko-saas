"use client";

import type { PointerEvent as ReactPointerEvent } from "react";

type CueLike = {
  id: string | null;
  tempId: string;
  cueIndex: number;
  startMs: number;
  endMs: number;
  text: string;
};

type WaveformCueRegionItemProps = {
  cue: CueLike;
  leftPx: number;
  widthPx: number;
  hasProblems: boolean;
  isPlaybackHere: boolean;
  isSelectedHere: boolean;
  isEditFocusHere: boolean;
  isEdgeDragging: boolean;
  isMoveDragging: boolean;
  dragEdge: "start" | "end" | null;
  waveformDurationSec: number | null;
  minGapMs: number;
  formatPlaybackTime: (ms: number) => string;
  onEdgePointerDown: (
    e: ReactPointerEvent<HTMLDivElement>,
    cue: CueLike,
    edge: "start" | "end",
  ) => void;
  onEdgePointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onEdgePointerEnd: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onMovePointerDown: (e: ReactPointerEvent<HTMLElement>, cue: CueLike) => void;
  onMovePointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  onMovePointerEnd: (e: ReactPointerEvent<HTMLElement>) => void;
  onBodyClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onBodyDoubleClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  onCueContextMenu: (e: React.MouseEvent, cue: CueLike) => void;
};

export function WaveformCueRegionItem({
  cue,
  leftPx,
  widthPx,
  hasProblems,
  isPlaybackHere,
  isSelectedHere,
  isEditFocusHere,
  isEdgeDragging,
  isMoveDragging,
  dragEdge,
  waveformDurationSec,
  minGapMs,
  formatPlaybackTime,
  onEdgePointerDown,
  onEdgePointerMove,
  onEdgePointerEnd,
  onMovePointerDown,
  onMovePointerMove,
  onMovePointerEnd,
  onBodyClick,
  onBodyDoubleClick,
  onCueContextMenu,
}: WaveformCueRegionItemProps) {
  return (
    <div
      key={cue.tempId}
      data-editor-cue-sync="region"
      data-cue-tempid={cue.tempId}
      data-editor-cue-warn={hasProblems ? "true" : "false"}
      data-editor-cue-playback={isPlaybackHere ? "true" : "false"}
      data-editor-cue-selected={isSelectedHere ? "true" : "false"}
      data-editor-cue-edit-focus={isEditFocusHere ? "true" : "false"}
      data-editor-edge-drag={isEdgeDragging ? dragEdge : undefined}
      className={`editor-waveform-cue-region ${
        isPlaybackHere ? "editor-waveform-cue-region--active" : ""
      } ${isSelectedHere ? "editor-waveform-cue-region--selected" : ""} ${
        isEditFocusHere ? "editor-waveform-cue-region--edit-focus" : ""
      } ${hasProblems ? "editor-waveform-cue-region--warn" : ""} ${
        isEdgeDragging ? "editor-waveform-cue-region--edge-dragging" : ""
      } ${isMoveDragging ? "editor-waveform-cue-region--move-dragging" : ""}`}
      style={{
        left: `${leftPx}px`,
        width: `${widthPx}px`,
      }}
      title={`Cue ${cue.cueIndex} · ${formatPlaybackTime(cue.startMs)} → ${formatPlaybackTime(cue.endMs)}`}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onCueContextMenu(e, cue);
      }}
    >
      <div
        className={`editor-waveform-cue-handle editor-waveform-cue-handle--start ${
          isEdgeDragging && dragEdge === "start"
            ? "editor-waveform-cue-handle--dragging"
            : ""
        }`}
        role="slider"
        aria-label={`Ajustar início da cue ${cue.cueIndex} (arrastar)`}
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={cue.endMs - minGapMs}
        aria-valuenow={cue.startMs}
        aria-valuetext={`${cue.startMs} ms`}
        onPointerDown={(e) => onEdgePointerDown(e, cue, "start")}
        onPointerMove={onEdgePointerMove}
        onPointerUp={onEdgePointerEnd}
        onPointerCancel={onEdgePointerEnd}
      />
      <button
        type="button"
        className={`editor-waveform-cue-region-body ${
          isMoveDragging ? "editor-waveform-cue-region-body--move-dragging" : ""
        }`}
        title={`Cue ${cue.cueIndex} — 1× ir para posição · 2× selecionar/editar · ${formatPlaybackTime(cue.startMs)} → ${formatPlaybackTime(cue.endMs)}\n${cue.text.slice(0, 200)}`}
        onPointerDown={(e) => onMovePointerDown(e, cue)}
        onPointerMove={onMovePointerMove}
        onPointerUp={onMovePointerEnd}
        onPointerCancel={onMovePointerEnd}
        onClick={onBodyClick}
        onDoubleClick={onBodyDoubleClick}
      >
        {cue.text.trim() ? (
          <span className="editor-waveform-cue-preview whitespace-pre-line" aria-hidden>
            {cue.text.trim()}
          </span>
        ) : (
          <span className="editor-waveform-cue-preview-spacer" aria-hidden />
        )}
        <div className="editor-waveform-cue-meta" aria-hidden>
          <span>#{cue.cueIndex}</span>
          <span>{((cue.endMs - cue.startMs) / 1000).toFixed(2)}s</span>
        </div>
      </button>
      <div
        className={`editor-waveform-cue-handle editor-waveform-cue-handle--end ${
          isEdgeDragging && dragEdge === "end"
            ? "editor-waveform-cue-handle--dragging"
            : ""
        }`}
        role="slider"
        aria-label={`Ajustar fim da cue ${cue.cueIndex} (arrastar)`}
        aria-orientation="horizontal"
        aria-valuemin={cue.startMs + minGapMs}
        aria-valuemax={
          waveformDurationSec != null
            ? Math.floor(waveformDurationSec * 1000)
            : cue.endMs
        }
        aria-valuenow={cue.endMs}
        aria-valuetext={`${cue.endMs} ms`}
        onPointerDown={(e) => onEdgePointerDown(e, cue, "end")}
        onPointerMove={onEdgePointerMove}
        onPointerUp={onEdgePointerEnd}
        onPointerCancel={onEdgePointerEnd}
      />
    </div>
  );
}
