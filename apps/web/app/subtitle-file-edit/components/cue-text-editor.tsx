"use client";

import "./cue-text-editor.css";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  autoBrText,
  charCountForCps,
  CPL_MAX_CHARS,
  CPS_CRIT_ABOVE,
  CPS_WARN_ABOVE,
} from "../lib/cue-utils";
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
    const totalLength = charCountForCps(localText);
    const durationSec = Math.max(0.001, (cue.endMs - cue.startMs) / 1000);
    const cps = totalLength / durationSec;
    const durationMs = cue.endMs - cue.startMs;
    const cpsBarBg =
      cps > CPS_CRIT_ABOVE
        ? "#E24B4A"
        : cps > CPS_WARN_ABOVE
          ? "#BA7517"
          : "#1D9E75";
    return {
      longestLine,
      totalLength,
      lineCount: lines.length,
      durationMs,
      cps,
      cpsTone:
        cps > CPS_CRIT_ABOVE
          ? "text-red-400"
          : cps > CPS_WARN_ABOVE
            ? "text-amber-300"
            : "text-emerald-300",
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
    <section className="editor-container flex flex-col h-full min-h-0">
      {/* ── HEADER ── */}
      <div className="editor-header flex items-center gap-[8px] px-[12px] py-[7px] bg-[#1e1e1e] border-b border-[#252525] flex-shrink-0">
        {/* badge da cue */}
        <div className="flex-shrink-0 rounded-[4px] border border-[#0F6E56] bg-[#0d3d2a] px-[7px] py-[2px] font-mono text-[11px] font-[600] text-[#5DCAA5]">
          #{cue.cueIndex}
        </div>

        {/* timing compacto */}
        <div className="flex items-center gap-[4px] font-mono text-[11px] text-[#505050]">
          <span>{formatShort(cue.startMs)}</span>
          <span className="text-[#333] text-[10px]">→</span>
          <span>{formatShort(cue.endMs)}</span>
          <span className="text-[#333] text-[10px] ml-[2px]">· {metrics.durationMs}ms</span>
        </div>

        {/* spacer */}
        <div className="flex-1" />

        {/* botão Auto br / Unbreak */}
        <button
          type="button"
          onClick={handleToggleBreakMode}
          className="flex h-[24px] items-center gap-[4px] rounded-[4px] border border-[#333] bg-[#252525] px-[8px] text-[11px] text-[#909090] hover:bg-[#2a2a2a] hover:text-[#e8e8e8] transition-colors"
        >
          {hasLineBreak ? "Unbreak" : "Auto br"}
        </button>

        {/* valor CPS */}
        <div className="flex items-baseline gap-[2px]">
          <span className={`font-mono text-[12px] font-[600] tabular-nums ${metrics.cpsTone}`}>
            {metrics.cps.toFixed(1)}
          </span>
          <span className="text-[11px] text-[#444]">c/s</span>
        </div>

        {/* fechar */}
        <button
          type="button"
          onClick={handleEscapeClose}
          className="flex h-[22px] w-[22px] items-center justify-center rounded-[4px] text-[16px] leading-none text-[#444] hover:bg-[#252525] hover:text-[#909090] transition-colors"
          title="Fechar (Esc)"
        >
          ×
        </button>
      </div>

      {/* ── BARRA CPS — 2px, filho direto, NUNCA border-top ── */}
      <div className="editor-cps-track h-[2px] w-full flex-shrink-0 bg-[#1a1a1a]" aria-hidden>
        <div
          className="editor-cps-bar h-full transition-[width,background-color] duration-150"
          style={{
            width: `${metrics.cpsBarWidth}%`,
            background:
              metrics.cps > CPS_CRIT_ABOVE
                ? "#E24B4A"
                : metrics.cps > CPS_WARN_ABOVE
                  ? "#BA7517"
                  : "#1D9E75",
          }}
        />
      </div>

      {/* ── TEXTAREA ── */}
      <textarea
        ref={textRef}
        value={localText}
        spellCheck={false}
        rows={6}
        onChange={(e) => {
          setLocalText(e.target.value);
          onCommitText(cue.tempId, e.target.value);
        }}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            handleEscapeClose();
          }
        }}
        className="editor-textarea flex-1 min-h-0 resize-none border-0 bg-[#161616] px-[14px] pt-[14px] pb-[10px] font-mono text-[15px] leading-[1.55] text-[#e8e8e8] outline-none placeholder:text-[#404040]"
        placeholder="Texto da legenda…"
      />

      {/* ── NAVEGAÇÃO (↑↓) + posição ── */}
      <div className="editor-nav-row">
        <div className="flex gap-[4px]">
          <button
            type="button"
            onClick={() => onNavigate("prev")}
            disabled={cueIndex === 0}
            className="flex h-[22px] w-[22px] items-center justify-center rounded-[4px] border border-[#2e2e2e] bg-[#252525] text-[11px] text-[#555] hover:bg-[#2a2a2a] hover:text-[#909090] disabled:cursor-not-allowed disabled:opacity-30 transition-colors"
            title="Cue anterior"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onNavigate("next")}
            disabled={cueIndex >= totalCues - 1}
            className="flex h-[22px] w-[22px] items-center justify-center rounded-[4px] border border-[#2e2e2e] bg-[#252525] text-[11px] text-[#555] hover:bg-[#2a2a2a] hover:text-[#909090] disabled:cursor-not-allowed disabled:opacity-30 transition-colors"
            title="Próxima cue"
          >
            ↓
          </button>
        </div>
        <span className="font-mono text-[10px] text-[#333]">
          {cueIndex + 1} / {totalCues}
        </span>
      </div>

      {/* ── FOOTER stats ── */}
      <div className="editor-footer">
        <span className="text-[10px] text-[#444]">
          Linha longa:{" "}
          <strong
            className={`font-[500] ${metrics.longestLine > CPL_MAX_CHARS ? "text-[#E24B4A]" : "text-[#606060]"}`}
          >
            {metrics.longestLine}
          </strong>
          <span className="text-[#333]">/{CPL_MAX_CHARS}</span>
        </span>
        <span className="text-[10px] text-[#444]">
          Chars: <strong className="font-[500] text-[#606060]">{metrics.totalLength}</strong>
        </span>
        <span className="text-[10px] text-[#444]">
          Linhas: <strong className="font-[500] text-[#606060]">{metrics.lineCount}</strong>
        </span>
      </div>
    </section>
  );
}
