"use client";

type CueListItemCue = {
  tempId: string;
  cueIndex: number;
  startMs: number;
  endMs: number;
  text: string;
};

type CueListItemProps = {
  cue: CueListItemCue;
  problems: string[];
  isPlaybackCue: boolean;
  isSelectedCue: boolean;
  isEditFocusCue: boolean;
  nextCueStartMs: number | null;
  assignCueRef: (tempId: string, element: HTMLElement | null) => void;
  shouldIgnoreCueClick: (target: EventTarget | null) => boolean;
  onSelectSingle: (cue: CueListItemCue) => void;
  onSelectDouble: (cue: CueListItemCue) => void;
  onUpdateCue: (
    tempId: string,
    patch: Partial<Pick<CueListItemCue, "startMs" | "endMs">>,
  ) => void;
};

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
  onUpdateCue,
}: CueListItemProps) {
  const hasProblems = problems.length > 0;
  const durationMs = cue.endMs - cue.startMs;
  const problemSummary = problems.join(" · ");
  const cps = durationMs > 0 ? cue.text.replace(/\s+/g, "").length / (durationMs / 1000) : 0;
  const cpsLevel =
    cps > 21 ? "danger" : cps >= 17 ? "warning" : "ok";
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

  const qualityIndicators: Array<{ icon: string; title: string; tone: string }> = [];
  if (cps > 21) {
    qualityIndicators.push({
      icon: "⚡",
      title: `CPS alto (${cps.toFixed(1)})`,
      tone: "text-red-400",
    });
  }
  if (hasLongGap) {
    qualityIndicators.push({
      icon: "⏎",
      title: `Gap longo para próxima cue (${gapMs}ms)`,
      tone: "text-amber-300",
    });
  }
  if (hasEmptyText) {
    qualityIndicators.push({
      icon: "!",
      title: "Texto vazio",
      tone: "text-orange-300",
    });
  }
  if (hasOverlap) {
    qualityIndicators.push({
      icon: "⚠",
      title: "Overlap com próxima cue",
      tone: "text-red-400",
    });
  }

  return (
    <article
      ref={(element) => {
        assignCueRef(cue.tempId, element);
      }}
      tabIndex={-1}
      role="listitem"
      data-editor-cue-sync="row"
      data-editor-cue-selected={isSelectedCue ? "true" : "false"}
      data-editor-cue-playback={isPlaybackCue ? "true" : "false"}
      data-editor-cue-warn={hasProblems ? "true" : "false"}
      data-editor-cue-edit-focus={isEditFocusCue ? "true" : "false"}
      className={`editor-cue-panel-row editor-cue-line editor-cue-strip editor-cue-row group grid min-w-0 cursor-pointer grid-cols-[40px_200px_minmax(0,1fr)_56px] items-center border-b border-zinc-800/40 font-mono transition-colors hover:bg-zinc-900/25 ${
        hasProblems ? "mvp-cue-card--warn" : ""
      } ${isPlaybackCue ? "editor-cue-card--playback" : ""} ${isSelectedCue ? "editor-cue-card--selected" : ""} ${
        isEditFocusCue ? "editor-cue-card--edit-focus" : ""
      } ${isSelectedCue ? "border-l-[3px] border-l-blue-500/90 bg-blue-500/15" : "border-l-[3px] border-l-transparent"}`}
      onClick={(event) => {
        if (shouldIgnoreCueClick(event.target)) return;
        if (event.detail >= 2) {
          onSelectDouble(cue);
          return;
        }
        if (event.detail === 1) {
          onSelectSingle(cue);
        }
      }}
      title={hasProblems ? `Problemas: ${problemSummary}` : undefined}
    >
      {/* Index */}
      <div
        className={`flex h-full items-center justify-center px-1 text-center text-[11px] tabular-nums leading-none ${
          isSelectedCue ? "text-blue-300" : "text-zinc-500/70"
        }`}
      >
        {cue.cueIndex}
      </div>

      {/* Time column */}
      <div className="min-w-0 px-1.5 py-1.5">
        <div className="text-[12px] tabular-nums leading-snug text-zinc-300/90">
          <span className="text-zinc-200/90">{formatShort(cue.startMs)}</span>
          <span className="mx-1 text-zinc-600">→</span>
          <span className="text-zinc-400/90">{formatShort(cue.endMs)}</span>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] leading-none">
          <span className="text-zinc-600">{durationMs}ms</span>
          {qualityIndicators.map((indicator) => (
            <span
              key={indicator.icon + indicator.title}
              className={`${indicator.tone} text-[10px]`}
              title={indicator.title}
            >
              {indicator.icon}
            </span>
          ))}
        </div>
        {isSelectedCue || isEditFocusCue ? (
          <div className="mt-1 flex min-w-0 items-center gap-1">
            <label className="inline-flex items-center gap-0.5">
              <span className="text-[9px] text-zinc-600">in</span>
              <input
                type="number"
                inputMode="numeric"
                className="editor-cue-ms-input h-4 w-[3.5rem] rounded border border-zinc-700/60 bg-zinc-900 py-0 px-1 text-[10px] tabular-nums text-zinc-300 outline-none focus:border-blue-500/60"
                value={cue.startMs}
                onChange={(e) => {
                  const parsed = Number.parseInt(e.target.value, 10);
                  if (!Number.isFinite(parsed)) return;
                  onUpdateCue(cue.tempId, { startMs: parsed });
                }}
              />
            </label>
            <label className="inline-flex items-center gap-0.5">
              <span className="text-[9px] text-zinc-600">out</span>
              <input
                type="number"
                inputMode="numeric"
                className="editor-cue-ms-input h-4 w-[3.5rem] rounded border border-zinc-700/60 bg-zinc-900 py-0 px-1 text-[10px] tabular-nums text-zinc-300 outline-none focus:border-blue-500/60"
                value={cue.endMs}
                onChange={(e) => {
                  const parsed = Number.parseInt(e.target.value, 10);
                  if (!Number.isFinite(parsed)) return;
                  onUpdateCue(cue.tempId, { endMs: parsed });
                }}
              />
            </label>
          </div>
        ) : null}
      </div>

      {/* Text column */}
      <div className="min-w-0 px-2 py-1.5">
        <p className="line-clamp-3 whitespace-pre-line break-words text-[13px] leading-[1.4] text-zinc-100">
          {cue.text.trim() || <span className="text-zinc-600 italic">vazio</span>}
        </p>
        <span
          className={`mt-0.5 inline-block rounded px-1.5 py-[1px] text-[10px] leading-none ${
            cpsLevel === "danger"
              ? "bg-red-500/10 text-red-400"
              : cpsLevel === "warning"
                ? "bg-amber-500/10 text-amber-300"
                : "bg-emerald-500/10 text-emerald-300"
          }`}
          title={`Chars por segundo: ${cps.toFixed(1)}`}
        >
          {cps.toFixed(1)}cps
        </span>
      </div>

      {/* Actions column */}
      <div
        className={`editor-cue-line-actions flex h-full items-center justify-end gap-0.5 px-1 ${
          isSelectedCue || isEditFocusCue
            ? "opacity-100"
            : "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        }`}
      />
    </article>
  );
}
