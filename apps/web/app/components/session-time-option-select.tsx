"use client";

import { useEffect, useRef, useState } from "react";

const DROPDOWN_MAX_H = "max-h-[min(27rem,_45vh)]";
const LIST_PANEL =
  "rounded-[6px] border border-[#3d3d3d] bg-[#1f1f1f] py-0.5 shadow-[0_8px_24px_rgba(0,0,0,0.45)]";
const ROW_BASE =
  "flex w-full min-h-[36px] items-center px-[10px] text-left text-[13px] text-white";
const ROW_HOVER = "hover:bg-[#2a3444]";
const ROW_SELECTED = "bg-[#3d6ea8] hover:bg-[#4a7ab8]";

export const HOUR_OPTIONS_24H = Array.from({ length: 24 }, (_, i) =>
  String(i).padStart(2, "0"),
);

export const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) =>
  String(i).padStart(2, "0"),
);

export function SessionTimeOptionSelect({
  value,
  options,
  onChange,
  inputClassName,
}: {
  value: string;
  options: readonly string[];
  onChange: (next: string) => void;
  inputClassName: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const row = listRef.current.querySelector(`[data-opt="${value}"]`);
    row?.scrollIntoView({ block: "nearest" });
  }, [open, value]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className={`${inputClassName} flex w-full items-center text-left ${
          open ? "border-[#1D9E75]" : ""
        }`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {value}
      </button>
      {open ? (
        <div
          ref={listRef}
          className={`absolute left-0 right-0 top-full z-50 mt-px ${DROPDOWN_MAX_H} overflow-y-auto ${LIST_PANEL}`}
          role="listbox"
        >
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              data-opt={opt}
              role="option"
              aria-selected={opt === value}
              className={`${ROW_BASE} ${ROW_HOVER} ${
                opt === value ? ROW_SELECTED : ""
              }`}
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
