"use client";

import "./cue-text-editor.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { autoBrText } from "../lib/cue-utils";
import type { CueTextEditorProps } from "../types";

function formatShort(ms: number): string {
  const totalSec = Math.max(0, ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = (totalSec % 60).toFixed(1);
  return `${String(m).padStart(2, "0")}:${s.padStart(4, "0")}`;
}

export function CueTextEditor({
  cue,
  cueIndex,
  totalCues,
  onClose,
  onCommitText,
  onNavigate,
}: CueTextEditorProps) {
  const [localText, setLocalText] = useState(cue.text);
  const textRef = useRef<HTMLTextAreaElement | null>(null);

  /** Ao abrir ou mudar de cue, foca o textarea e coloca o cursor no fim do texto. */
  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    requestAnimationFrame(() => {
      el.focus();
      const len = el.value.length;
      try {
        el.setSelectionRange(len, len);
      } catch {
        /* ignore */
      }
    });
  }, [cue.tempId]);

  const metrics = useMemo(() => {
    const lines = localText.split("\n");
    const longestLine = Math.max(0, ...lines.map((line) => line.length));
    const totalLength = localText.replace(/\n/g, "").length;
    const durationSec = Math.max(0.001, (cue.endMs - cue.startMs) / 1000);
    const cps = totalLength / durationSec;
    const durationMs = cue.endMs - cue.startMs;
    const cpsBarBg =
      cps > 21
        ? "var(--error-dot)"
        : cps > 17
          ? "var(--warn-text)"
          : "var(--success-dot)";
    return {
      longestLine,
      totalLength,
      lineCount: lines.length,
      durationMs,
      cps,
      cpsTone:
        cps > 21 ? "text-red-400" : cps > 17 ? "text-amber-300" : "text-emerald-300",
      cpsBarWidth: Math.min(100, (cps / 25) * 100),
      cpsBarBg,
    };
  }, [cue.endMs, cue.startMs, localText]);

  function commitText() {
    if (localText !== cue.text) {
      onCommitText(cue.tempId, localText);
    }
  }

  function handleEscapeClose() {
    commitText();
    onClose();
  }

  function handleUnbreak() {
    const joined = localText.split("\n").join(" ").replace(/\s+/g, " ").trim();
    setLocalText(joined);
    onCommitText(cue.tempId, joined);
  }

  function handleAutoBr() {
    const flat = localText.split("\n").join(" ").replace(/\s+/g, " ").trim();
    if (!flat) return;
    const result = autoBrText(flat);
    setLocalText(result);
    onCommitText(cue.tempId, result);
  }

  const hasLineBreak = localText.includes("\n");

  function handleToggleBreakMode() {
    if (hasLineBreak) {
      handleUnbreak();
      return;
    }
    handleAutoBr();
  }

  return (
    <section className="editor-container mt-0 flex h-full min-h-0 flex-col px-2 pb-2 pt-2 sm:px-3 sm:pb-3 sm:pt-3">
      <div className="editor-header flex min-h-[3.25rem] shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[#1a1a1a] px-4 py-3 sm:px-5 sm:py-3.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1.5 sm:gap-x-4">
          <span className="editor-cue-id-badge shrink-0 rounded-md bg-blue-600/20 px-3 py-1 font-mono text-[11px] font-semibold leading-none text-blue-400">
            #{cue.cueIndex}
          </span>
          <span className="shrink-0 font-mono text-[10px] leading-snug text-zinc-500">
            {formatShort(cue.startMs)}
            <span className="mx-1.5 text-zinc-600">→</span>
            {formatShort(cue.endMs)}
          </span>
          <span className="shrink-0 text-[10px] leading-snug text-zinc-600">
            {metrics.durationMs}ms
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <button
            type="button"
            onClick={handleToggleBreakMode}
            className="editor-auto-br-btn inline-flex min-h-[2rem] min-w-[5.25rem] shrink-0 items-center justify-center whitespace-nowrap rounded-md border border-zinc-600/90 bg-zinc-800/90 px-3 py-2 text-center text-[12px] font-medium leading-none tracking-tight text-zinc-100 shadow-sm hover:border-zinc-500 hover:bg-zinc-700/80"
            title={hasLineBreak ? "Remover quebra de linha automática" : "Aplicar quebra automática"}
          >
            {hasLineBreak ? "Unbreak" : "Auto br"}
          </button>
          <span className="font-mono text-[12px] tabular-nums">
            <span className={`font-semibold ${metrics.cpsTone}`}>{metrics.cps.toFixed(1)}</span>
            <span className="text-zinc-500"> c/s</span>
          </span>
          <button
            type="button"
            onClick={handleEscapeClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-lg leading-none text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            title="Fechar (Esc)"
          >
            ×
          </button>
        </div>
      </div>

      <div className="editor-cps-track" aria-hidden>
        <div
          className="editor-cps-bar"
          style={{
            width: `${metrics.cpsBarWidth}%`,
            backgroundColor: metrics.cpsBarBg,
          }}
        />
      </div>

      <textarea
        ref={textRef}
        value={localText}
        rows={6}
        spellCheck={false}
        onChange={(e) => {
          const v = e.target.value;
          setLocalText(v);
          onCommitText(cue.tempId, v);
        }}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            handleEscapeClose();
          }
        }}
        className="editor-textarea h-full min-h-0 flex-1 resize-none px-5 py-5 font-mono text-[19px] leading-[1.55] tracking-tight text-zinc-100 placeholder:text-zinc-600"
        placeholder="Texto da legenda…"
      />

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-[#1a1a1a] px-5 py-3 sm:px-6">
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => onNavigate("prev")}
          disabled={cueIndex === 0}
          className="inline-flex h-9 min-w-[2.5rem] items-center justify-center rounded-md border border-zinc-700/80 bg-zinc-800/70 px-3 text-sm text-zinc-400 hover:bg-zinc-700/70 disabled:cursor-not-allowed disabled:opacity-30"
          title="Cue anterior"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onNavigate("next")}
          disabled={cueIndex >= totalCues - 1}
          className="inline-flex h-9 min-w-[2.5rem] items-center justify-center rounded-md border border-zinc-700/80 bg-zinc-800/70 px-3 text-sm text-zinc-400 hover:bg-zinc-700/70 disabled:cursor-not-allowed disabled:opacity-30"
          title="Próxima cue"
        >
          ↓
        </button>
      </div>

      <div className="editor-footer mt-0.5 flex min-h-[2.75rem] shrink-0 items-center justify-between gap-4 border-t border-white/5 bg-[#181818] px-5 py-3 sm:px-6 sm:py-3.5">
        <div className="editor-footer-stats flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1.5 sm:gap-x-6">
          <span className="text-[11px] leading-snug text-white/40">
            Linha longa:{" "}
            <strong className={`font-semibold ${metrics.longestLine > 42 ? "text-red-400" : "text-white/60"}`}>
              {metrics.longestLine}
            </strong>
            <span className="text-white/25">/42</span>
          </span>
          <span className="text-[11px] leading-snug text-white/40">
            Chars:{" "}
            <strong className="font-semibold text-white/60">{metrics.totalLength}</strong>
          </span>
          <span className="text-[11px] leading-snug text-white/40">
            Linhas:{" "}
            <strong className="font-semibold text-white/60">{metrics.lineCount}</strong>
          </span>
        </div>
        <span className="shrink-0 pl-3 font-mono text-[11px] leading-none tabular-nums text-zinc-500">
          {cueIndex + 1} / {totalCues}
        </span>
      </div>
    </section>
  );
}
