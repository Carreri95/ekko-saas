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
      className="context-menu fixed select-none"
      style={{
        left: pos.left,
        top: pos.top,
      }}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
    >
      {canAddText ? (
        <button
          type="button"
          role="menuitem"
          className="context-menu-item w-full"
          onClick={() => onAddText()}
        >
          Adicionar texto
        </button>
      ) : null}
      <button
        type="button"
        role="menuitem"
        disabled={!canSplit}
        className={`context-menu-item w-full ${
          canSplit ? "" : "cursor-not-allowed opacity-40"
        }`}
        onClick={() => {
          if (!canSplit) return;
          onSplit();
        }}
      >
        Dividir aqui
      </button>
      <div className="context-menu-sep" />
      <button
        type="button"
        role="menuitem"
        className="context-menu-item danger w-full"
        onClick={() => onDelete()}
      >
        Deletar cue
      </button>
    </div>,
    document.body,
  );
}
