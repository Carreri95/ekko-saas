"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { WaveformContextMenuProps } from "../types";

export function WaveformContextMenu({
  x,
  y,
  canAddText,
  canSplit,
  onAddText,
  onSplit,
  onDelete,
}: WaveformContextMenuProps) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    let left = x;
    let top = y;
    const pad = 6;
    if (left + r.width > window.innerWidth - pad) {
      left = Math.max(pad, window.innerWidth - r.width - pad);
    }
    if (top + r.height > window.innerHeight - pad) {
      top = Math.max(pad, window.innerHeight - r.height - pad);
    }
    if (left < pad) left = pad;
    if (top < pad) top = pad;
    setPos({ left, top });
  }, [x, y]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      data-waveform-context-menu
      className="fixed z-[200] min-w-[160px] select-none py-0.5"
      style={{
        left: pos.left,
        top: pos.top,
        background: "#1a1a1a",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 6,
        boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
      }}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
    >
      {canAddText ? (
        <button
          type="button"
          role="menuitem"
          className="w-full cursor-pointer rounded-[5px] px-[14px] py-[6px] text-left text-[12px] text-zinc-100 transition-colors hover:bg-zinc-800"
          onClick={() => onAddText()}
        >
          Adicionar texto
        </button>
      ) : null}
      <button
        type="button"
        role="menuitem"
        disabled={!canSplit}
        className={`w-full rounded-[5px] px-[14px] py-[6px] text-left text-[12px] text-zinc-100 transition-colors ${
          canSplit
            ? "cursor-pointer hover:bg-zinc-800"
            : "cursor-not-allowed opacity-40"
        }`}
        onClick={() => {
          if (!canSplit) return;
          onSplit();
        }}
      >
        Dividir aqui
      </button>
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,0.07)",
          margin: "3px 0",
        }}
      />
      <button
        type="button"
        role="menuitem"
        style={{
          display: "block",
          width: "100%",
          padding: "6px 14px",
          fontSize: "12px",
          textAlign: "left",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "rgba(248, 113, 113, 0.9)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(239,68,68,0.12)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "transparent";
        }}
        onClick={() => onDelete()}
      >
        Deletar cue
      </button>
    </div>,
    document.body,
  );
}
