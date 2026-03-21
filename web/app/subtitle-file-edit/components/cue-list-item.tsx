"use client";

import type { CueListItemProps } from "../types";

export function CueListItem({
  cue,
  problems,
  isPlaybackCue,
  isSelectedCue,
  isEditFocusCue,
  nextCueStartMs,
  assignCueRef,
  shouldIgnoreCueClick,
  onSelectSingle,
  onSelectDouble,
}: CueListItemProps) {
  const hasProblems = problems.length > 0;
  const durationMs = cue.endMs - cue.startMs;
  const problemSummary = problems.join(" · ");
  const cps =
    durationMs > 0
      ? cue.text.replace(/\s+/g, "").length / (durationMs / 1000)
      : 0;
  const gapMs =
    nextCueStartMs != null ? Math.max(0, nextCueStartMs - cue.endMs) : 0;
  const hasLongGap = gapMs > 2000;
  const hasOverlap = problems.some((p) => p.startsWith("overlap"));
  const hasEmptyText = problems.some((p) => p.startsWith("texto vazio"));

  function formatShort(ms: number): string {
    const totalSec = Math.max(0, ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = (totalSec % 60).toFixed(1);
    return `${String(m).padStart(2, "0")}:${s.padStart(4, "0")}`;
  }

  /** bg + border-l (2px) — precedência: playback+selecionado → selecionado → edit focus → playback → problema → neutro */
  const rowState = (() => {
    if (isSelectedCue && isPlaybackCue) {
      return "bg-blue-950/50 border-l-blue-400";
    }
    if (isSelectedCue) {
      return "bg-blue-950/40 border-l-blue-500";
    }
    if (isEditFocusCue) {
      return "bg-cyan-950/30 border-l-cyan-500";
    }
    if (isPlaybackCue) {
      return "bg-amber-950/20 border-l-amber-500";
    }
    if (hasProblems) {
      return "bg-transparent border-l-orange-600/60";
    }
    return "bg-transparent border-l-transparent";
  })();

  const timeRowOpacity =
    isSelectedCue || isEditFocusCue ? "opacity-100" : "opacity-70";

  const bodyTextClass = hasProblems
    ? "text-orange-200/90"
    : isPlaybackCue && !isSelectedCue
      ? "text-amber-100"
      : "text-zinc-100";

  const cpsClass =
    cps > 21
      ? "text-red-400"
      : cps >= 17
        ? "text-amber-300"
        : "text-zinc-600";

  const rowPad =
    isSelectedCue || isEditFocusCue ? "py-3.5" : "py-3";

  return (
    <article
      ref={(el) => assignCueRef(cue.tempId, el)}
      tabIndex={-1}
      role="listitem"
      data-editor-cue-sync="row"
      data-editor-cue-selected={isSelectedCue ? "true" : "false"}
      data-editor-cue-playback={isPlaybackCue ? "true" : "false"}
      data-editor-cue-warn={hasProblems ? "true" : "false"}
      data-editor-cue-edit-focus={isEditFocusCue ? "true" : "false"}
      className={`editor-cue-list-row group relative grid min-w-0 cursor-pointer items-start border-b border-zinc-900/80 border-l-2 transition-colors hover:bg-zinc-900/30 ${rowPad} ${rowState}`}
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
      {/* Coluna índice */}
      <div
        className={`flex min-h-[2.75rem] w-10 shrink-0 items-start justify-center pt-0.5 font-mono text-[11px] tabular-nums leading-none ${
          isSelectedCue
            ? "text-blue-400"
            : isPlaybackCue && !isSelectedCue
              ? "text-amber-400"
              : "text-zinc-600"
        }`}
      >
        {isSelectedCue ? (
          cue.cueIndex
        ) : isPlaybackCue ? (
          <span className="text-amber-400" aria-hidden>
            ▶
          </span>
        ) : (
          cue.cueIndex
        )}
      </div>

      {/* Conteúdo principal */}
      <div className="min-w-0 pr-2">
        {/* Linha 1 — timecodes */}
        <div
          className={`mb-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 font-mono text-[11px] tabular-nums leading-snug text-zinc-500 ${timeRowOpacity}`}
        >
          <span>{formatShort(cue.startMs)}</span>
          <span className="text-[10px] text-zinc-600">▶</span>
          <span>{formatShort(cue.endMs)}</span>
          <span className="text-zinc-600">·</span>
          <span className="text-[10px] text-zinc-500">{durationMs}ms</span>
          {hasOverlap && (
            <span className="text-[9px] text-red-400" title="Overlap">
              ⚠
            </span>
          )}
          {hasEmptyText && (
            <span className="text-[9px] text-orange-400" title="Texto vazio">
              !
            </span>
          )}
          {hasLongGap && (
            <span className="text-[9px] text-zinc-600" title={`Gap ${gapMs}ms`}>
              ↓
            </span>
          )}
        </div>

        {/* Linha 2 — texto */}
        <p
          className={`line-clamp-2 whitespace-pre-line break-words text-[14px] leading-[1.5] ${bodyTextClass}`}
        >
          {cue.text.trim() || (
            <span className="italic text-zinc-600">vazio</span>
          )}
        </p>
      </div>

      {/* CPS */}
      <div className="flex min-h-[2.75rem] w-full shrink-0 items-start justify-end pt-1 pr-0.5">
        <span
          className={`font-mono text-[11px] tabular-nums leading-tight ${cpsClass}`}
          title={`${cps.toFixed(1)} caracteres/s`}
        >
          {cps.toFixed(1)}
        </span>
      </div>
    </article>
  );
}
