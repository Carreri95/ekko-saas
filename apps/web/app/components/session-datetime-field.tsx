"use client";

import { DateInput } from "@/app/components/date-input";
import {
  HOUR_OPTIONS_24H,
  MINUTE_OPTIONS,
  SessionTimeOptionSelect,
} from "@/app/components/session-time-option-select";
import type { SessionDatetimeParts } from "@/app/lib/session-datetime";

type Props = {
  label: string;
  labelClassName: string;
  inputClassName: string;
  value: SessionDatetimeParts;
  onChange: (next: SessionDatetimeParts) => void;
  dateInputId?: string;
  /** Quando false, não exibe seletor de data (apenas hora/minuto). */
  showDatePicker?: boolean;
  /** Texto auxiliar sob o rótulo (ex.: mesmo dia do início). */
  dateDescription?: string;
  /** Substitui a lista de horas (ex.: só horas com fim válido). */
  hourOptions?: readonly string[];
  /** Substitui a lista de minutos (ex.: conforme hora de fim). */
  minuteOptions?: readonly string[];
};

export function SessionDatetimeField({
  label,
  labelClassName,
  inputClassName,
  value,
  onChange,
  dateInputId,
  showDatePicker = true,
  dateDescription,
  hourOptions = HOUR_OPTIONS_24H,
  minuteOptions = MINUTE_OPTIONS,
}: Props) {
  const patch = (partial: Partial<SessionDatetimeParts>) =>
    onChange({ ...value, ...partial });

  const hourOpts = hourOptions.length > 0 ? hourOptions : HOUR_OPTIONS_24H;
  const minuteOpts = minuteOptions.length > 0 ? minuteOptions : MINUTE_OPTIONS;

  return (
    <div className="min-w-0">
      <label className={labelClassName}>{label}</label>
      {dateDescription ? (
        <p className="mb-[6px] text-[11px] leading-snug text-[#707070]">{dateDescription}</p>
      ) : null}
      <div
        className={`grid gap-[6px] ${showDatePicker ? "grid-cols-3" : "grid-cols-2"}`}
      >
        {showDatePicker ? (
          <DateInput
            id={dateInputId}
            value={value.dateYmd}
            onChange={(v) => patch({ dateYmd: v })}
            className={inputClassName}
          />
        ) : null}
        <SessionTimeOptionSelect
          inputClassName={inputClassName}
          value={value.hour24}
          options={hourOpts}
          onChange={(hour24) => patch({ hour24 })}
        />
        <SessionTimeOptionSelect
          inputClassName={inputClassName}
          value={value.minute}
          options={minuteOpts}
          onChange={(minute) => patch({ minute })}
        />
      </div>
    </div>
  );
}
