"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CueLike = {
  tempId: string;
  cueIndex: number;
  startMs: number;
  endMs: number;
  text: string;
};

type CueTextEditorProps = {
  cue: CueLike;
  cueIndex: number;
  totalCues: number;
  onClose: () => void;
  onCommitText: (cueTempId: string, text: string) => void;
  onNavigate: (direction: "prev" | "next") => void;
};

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

  useEffect(() => {
    textRef.current?.focus();
  }, [cue.tempId]);

  const metrics = useMemo(() => {
    const lines = localText.split("\n");
    const longestLine = Math.max(0, ...lines.map((line) => line.length));
    const totalLength = localText.replace(/\n/g, "").length;
    const durationSec = Math.max(0.001, (cue.endMs - cue.startMs) / 1000);
    const cps = totalLength / durationSec;
    const durationMs = cue.endMs - cue.startMs;
    return {
      longestLine,
      totalLength,
      lineCount: lines.length,
      durationMs,
      cps,
      cpsTone:
        cps > 21 ? "text-red-400" : cps > 17 ? "text-amber-300" : "text-emerald-300",
      cpsBarWidth: Math.min(100, (cps / 25) * 100),
      cpsBarColor:
        cps > 21 ? "bg-red-500" : cps > 17 ? "bg-amber-400" : "bg-emerald-500",
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
    const mid = Math.floor(flat.length / 2);
    let splitAt = mid;
    for (let i = 0; i <= 12; i += 1) {
      if (flat[mid - i] === " ") {
        splitAt = mid - i;
        break;
      }
      if (flat[mid + i] === " ") {
        splitAt = mid + i;
        break;
      }
    }
    const result = `${flat.slice(0, splitAt)}\n${flat.slice(splitAt + 1)}`.trim();
    setLocalText(result);
    onCommitText(cue.tempId, result);
  }

  return (
    <section className="mt-0 flex h-full min-h-0 flex-col border border-zinc-800/90 bg-[#161616]">
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/10 bg-[#1a1a1a] px-3 py-1.5">
        <div className="flex items-center gap-2">
          <span className="rounded bg-blue-600/20 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-blue-400">
            #{cue.cueIndex}
          </span>
          <span className="font-mono text-[10px] text-zinc-600">
            {formatShort(cue.startMs)}
            <span className="mx-1 text-zinc-700">→</span>
            {formatShort(cue.endMs)}
          </span>
          <span className="text-[10px] text-zinc-700">
            {metrics.durationMs}ms
          </span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-[12px] tabular-nums">
            <span className={`font-semibold ${metrics.cpsTone}`}>{metrics.cps.toFixed(1)}</span>
            <span className="text-zinc-600"> c/s</span>
          </span>
          <button
            type="button"
            onClick={handleEscapeClose}
            className="rounded px-1.5 py-0.5 text-[14px] leading-none text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
            title="Fechar (Esc)"
          >
            ×
          </button>
        </div>
      </div>

      {/* CPS bar */}
      <div className="h-[3px] w-full shrink-0 bg-zinc-900">
        <div
          className={`h-full transition-all duration-150 ${metrics.cpsBarColor}`}
          style={{ width: `${metrics.cpsBarWidth}%`, opacity: 0.7 }}
        />
      </div>

      {/* Textarea */}
      <textarea
        ref={textRef}
        value={localText}
        rows={6}
        spellCheck={false}
        onChange={(e) => setLocalText(e.target.value)}
        onBlur={commitText}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            handleEscapeClose();
          }
        }}
        className="h-full min-h-0 flex-1 resize-none border-0 border-b border-white/10 bg-[#0e0e0e] px-3.5 py-3 font-mono text-[15px] leading-relaxed text-zinc-100 outline-none placeholder:text-zinc-700"
        placeholder="Texto da legenda…"
      />

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-[#1a1a1a] px-3 py-2">
        <button
          type="button"
          onClick={handleUnbreak}
          className="rounded border border-zinc-700/80 bg-zinc-800/70 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-zinc-700/70"
        >
          Unbreak
        </button>
        <button
          type="button"
          onClick={handleAutoBr}
          className="rounded border border-zinc-700/80 bg-zinc-800/70 px-2.5 py-1 text-[11px] text-zinc-200 hover:bg-zinc-700/70"
        >
          Auto br
        </button>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => onNavigate("prev")}
          disabled={cueIndex === 0}
          className="rounded border border-zinc-700/80 bg-zinc-800/70 px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-700/70 disabled:cursor-not-allowed disabled:opacity-30"
          title="Cue anterior"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onNavigate("next")}
          disabled={cueIndex >= totalCues - 1}
          className="rounded border border-zinc-700/80 bg-zinc-800/70 px-2 py-1 text-[11px] text-zinc-400 hover:bg-zinc-700/70 disabled:cursor-not-allowed disabled:opacity-30"
          title="Próxima cue"
        >
          ↓
        </button>
      </div>

      {/* Stats footer */}
      <div className="flex h-8 shrink-0 items-center justify-between border-t border-white/5 bg-[#181818] px-3">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-white/25">
            Linha longa:{" "}
            <strong className={`font-semibold ${metrics.longestLine > 42 ? "text-red-400" : "text-white/55"}`}>
              {metrics.longestLine}
            </strong>
            <span className="text-white/20">/42</span>
          </span>
          <span className="text-[10px] text-white/25">
            Chars:{" "}
            <strong className="font-semibold text-white/55">{metrics.totalLength}</strong>
          </span>
          <span className="text-[10px] text-white/25">
            Linhas:{" "}
            <strong className="font-semibold text-white/55">{metrics.lineCount}</strong>
          </span>
        </div>
        <span className="font-mono text-[10px] text-zinc-600">
          {cueIndex + 1} / {totalCues}
        </span>
      </div>
    </section>
  );
}
