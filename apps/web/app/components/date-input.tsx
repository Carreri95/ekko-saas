"use client";

import { format, isValid, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect, useId, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";

import "react-day-picker/style.css";

type DateInputProps = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
};

function parseYmdToLocalDate(ymd: string): Date | undefined {
  if (!ymd.trim()) return undefined;
  const d = parse(ymd, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

export function DateInput({
  value,
  onChange,
  placeholder = "dd/mm/aaaa",
  className,
  id: idProp,
}: DateInputProps) {
  const uid = useId();
  const triggerId = idProp ?? `${uid}-date-trigger`;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = parseYmdToLocalDate(value);
  const display =
    selected != null
      ? format(selected, "dd/MM/yyyy", { locale: ptBR })
      : "";

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    }
  }, [open]);

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        id={triggerId}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((o) => !o)}
        className={`${className ?? "flex w-full min-h-[36px] items-center rounded-[6px] border border-[#2e2e2e] bg-[#111] px-[10px] py-[8px] text-left text-[13px] leading-snug text-[#e8e8e8] outline-none transition-colors focus:border-[#1D9E75] focus:ring-0"} ${open ? "border-[#1D9E75]" : ""}`}
      >
        <span className={display ? "text-[#e8e8e8]" : "text-[#404040]"}>
          {display || placeholder}
        </span>
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-[55]"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <div
            className="date-input-popover absolute left-0 top-[calc(100%+6px)] z-[60] w-max min-w-[300px] max-w-[min(100vw-32px,360px)] rounded-[8px] border border-[#2e2e2e] bg-[#1e1e1e] p-3 shadow-[0_12px_40px_rgba(0,0,0,0.55)]"
            role="dialog"
            aria-label="Escolher data"
          >
            <DayPicker
              mode="single"
              locale={ptBR}
              selected={selected}
              defaultMonth={selected}
              onSelect={(day) => {
                if (day) {
                  onChange(format(day, "yyyy-MM-dd"));
                  setOpen(false);
                }
              }}
              className="date-input-rdp"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
