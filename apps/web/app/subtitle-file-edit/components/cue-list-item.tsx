"use client";

import { useMemo } from "react";
import {
  computeCueCps,
  CPS_CRIT_ABOVE,
  CPS_WARN_ABOVE,
} from "../lib/cue-utils";
import type { CueListItemProps } from "../types";

export function CueListItem({
  cue,
  problems,
  isPlaybackCue,
  isSelectedCue,
  isEditFocusCue,
  nextCueStartMs: _nextCueStartMs,
  assignCueRef,
  shouldIgnoreCueClick,
  onSelectSingle,
  onSelectDouble,
}: CueListItemProps) {
  const hasProblems = problems.length > 0;
  const problemSummary = problems.join(" · ");

  const cps = useMemo(
    () => computeCueCps(cue.text, cue.startMs, cue.endMs),
    [cue.text, cue.startMs, cue.endMs],
  );

  const cpsWarn = cps > CPS_WARN_ABOVE && cps <= CPS_CRIT_ABOVE;
  const cpsCrit = cps > CPS_CRIT_ABOVE;

  function formatShort(ms: number): string {
    const totalSec = Math.max(0, ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = (totalSec % 60).toFixed(1).padStart(4, "0");
    return `${String(m).padStart(2, "0")}:${s}`;
  }

  const timingShort = `${formatShort(cue.startMs)}→${formatShort(cue.endMs)}`;

  const textOneLine = cue.text.replace(/\n+/g, " ").trim();

  /* grid + colunas no Tailwind: garante layout mesmo se CSS importado perder para a cascata do Tailwind */
  const rowClassName = [
    "grid w-full shrink-0 grid-cols-[36px_112px_minmax(0,1fr)_56px] items-center gap-x-2 gap-y-0 overflow-hidden",
    "h-[34px] min-h-[34px] max-h-[34px]",
    "editor-cue-list-row min-w-0 border-l-[3px] cursor-pointer select-none transition-colors duration-[80ms]",
    isEditFocusCue
      ? "border-l-[#5DCAA5] bg-[#0d3d2a]"
      : isSelectedCue
        ? "border-l-[#1D9E75] bg-[rgba(29,158,117,0.08)]"
        : isPlaybackCue
          ? "border-l-[#1D9E75] bg-[rgba(29,158,117,0.06)]"
          : "border-l-transparent",
    !isSelectedCue && !isEditFocusCue && cpsCrit ? "bg-[rgba(61,13,13,0.12)]" : "",
    !isSelectedCue && !isEditFocusCue && !cpsCrit && cpsWarn
      ? "bg-[rgba(61,46,13,0.10)]"
      : "",
    "hover:bg-[#1a1a1a]",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      ref={(el) => assignCueRef(cue.tempId, el)}
      tabIndex={-1}
      role="listitem"
      data-editor-cue-sync="row"
      data-cue-tempid={cue.tempId}
      data-editor-cue-selected={isSelectedCue ? "true" : "false"}
      data-editor-cue-playback={isPlaybackCue ? "true" : "false"}
      data-editor-cue-warn={hasProblems ? "true" : "false"}
      data-editor-cue-edit-focus={isEditFocusCue ? "true" : "false"}
      className={rowClassName}
      onClick={(e) => {
        if (shouldIgnoreCueClick(e.target)) return;
        if (e.detail >= 2) {
          onSelectDouble(cue);
          return;
        }
        if (e.detail === 1) onSelectSingle(cue);
      }}
      title={hasProblems ? `Problemas: ${problemSummary}` : undefined}
    >
      {/* BADGE NÚMERO */}
      <div className="flex items-center justify-center">
        <div
          className={[
            "flex h-[18px] min-w-[22px] items-center justify-center rounded-[3px] border px-[3px] font-mono text-[9px]",
            isSelectedCue || isEditFocusCue
              ? "border-[#0F6E56] bg-[#0d3d2a] text-[#5DCAA5]"
              : "border-[#2a2a2a] bg-[#222] text-[#505050]",
          ].join(" ")}
        >
          {cue.cueIndex}
        </div>
      </div>

      {/* TIMING */}
      <div className="flex min-h-0 min-w-0 items-center overflow-hidden">
        <span className="block min-w-0 truncate font-mono text-[9px] text-[#707070]">{timingShort}</span>
      </div>

      {/* TEXTO */}
      <div className="flex min-h-0 min-w-0 items-center overflow-hidden pl-0.5 pr-[6px]">
        {textOneLine ? (
          <span
            className={[
              "truncate text-[12px] leading-none",
              isEditFocusCue ? "text-[#e8e8e8]" : "text-[#c8c8c8]",
            ].join(" ")}
            title={cue.text}
          >
            {textOneLine}
          </span>
        ) : (
          <span className="text-[11px] italic text-[#404040]">vazio</span>
        )}
      </div>

      {/* CPS — só o valor; cor indica aviso/crítico */}
      <div className="flex min-h-0 items-center justify-end pr-[6px]">
        <span
          className={[
            "font-mono text-[10px] tabular-nums leading-none",
            cpsCrit ? "text-[#E24B4A]" : cpsWarn ? "text-[#BA7517]" : "text-[#444]",
          ].join(" ")}
        >
          {cps.toFixed(1)}
        </span>
      </div>
    </div>
  );
}
