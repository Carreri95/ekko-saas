"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  filterOriginalLanguages,
  labelForOriginalLanguage,
  ORIGINAL_LANGUAGES,
} from "../lib/original-languages";

type Props = {
  value: string;
  onChange: (value: string) => void;
  /** id do botão (para <label htmlFor>) */
  id?: string;
  /** Classes do trigger (mesmo padrão dos outros inputs) */
  className?: string;
};

export function LanguageCombobox({
  value,
  onChange,
  id: triggerIdProp,
  className = "",
}: Props) {
  const uid = useId();
  const triggerId = triggerIdProp ?? `${uid}-trigger`;
  const listboxId = `${uid}-listbox`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(
    () => filterOriginalLanguages(query, ORIGINAL_LANGUAGES),
    [query],
  );

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    if (open) {
      document.addEventListener("mousedown", onDocMouseDown);
      queueMicrotask(() => searchRef.current?.focus());
    }
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [open]);

  const displayLabel = labelForOriginalLanguage(value);

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        id={triggerId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) setQuery("");
        }}
        className={`flex w-full min-h-[36px] items-center justify-between gap-2 rounded-[6px] border border-[#2e2e2e] bg-[#111] px-[10px] py-[8px] text-left text-[13px] leading-snug text-[#e8e8e8] outline-none transition-colors focus:border-[#1D9E75] focus:ring-0 ${open ? "border-[#1D9E75]" : ""} ${className}`}
      >
        <span className="min-w-0 flex-1 truncate">{displayLabel}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`shrink-0 text-[#505050] transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={triggerId}
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-[60] flex max-h-[min(320px,50vh)] flex-col overflow-hidden rounded-[6px] border border-[#2e2e2e] bg-[#161616] shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
        >
          <div className="shrink-0 border-b border-[#252525] p-2">
            <div className="flex items-center gap-2 rounded-[5px] border border-[#333] bg-[#111] px-[8px] py-[6px]">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#505050"
                strokeWidth="2"
                aria-hidden
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" strokeLinecap="round" />
              </svg>
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Pesquisar idioma…"
                className="min-w-0 flex-1 bg-transparent text-[12px] text-[#e8e8e8] outline-none placeholder:text-[#505050]"
                aria-label="Pesquisar idioma"
                autoComplete="off"
              />
            </div>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-4 text-center text-[11px] text-[#606060]">
                Nenhum idioma encontrado.
              </li>
            ) : (
              filtered.map((l) => {
                const selected = l.value === value;
                return (
                  <li key={l.value} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onChange(l.value);
                        setOpen(false);
                        setQuery("");
                      }}
                      className={`flex w-full rounded-[5px] px-3 py-2 text-left text-[12px] transition-colors ${
                        selected
                          ? "bg-[#0d3d2a] text-[#5DCAA5]"
                          : "text-[#c8c8c8] hover:bg-[#252525] hover:text-[#e8e8e8]"
                      }`}
                    >
                      {l.label}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
          <div className="shrink-0 border-t border-[#252525] px-3 py-2">
            <p className="text-[10px] leading-snug text-[#505050]">
              Idioma de áudio/fala original do material (valor guardado no projeto).
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
