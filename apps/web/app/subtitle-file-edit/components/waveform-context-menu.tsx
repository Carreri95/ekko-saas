"use client";

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
  if (typeof document === "undefined") return null;
  const pad = 6;
  const safeLeft = Math.max(pad, Math.min(window.innerWidth - pad, x));
  const safeTop = Math.max(pad, Math.min(window.innerHeight - pad, y));
  const flipX = x > window.innerWidth * 0.75;
  const flipY = y > window.innerHeight * 0.75;

  return createPortal(
    <div
      data-waveform-context-menu
      className="context-menu fixed select-none"
      style={{
        left: safeLeft,
        top: safeTop,
        transform: `translate(${flipX ? "-100%" : "0"}, ${flipY ? "-100%" : "0"})`,
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
