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
};

export function SessionDatetimeField({
  label,
  labelClassName,
  inputClassName,
  value,
  onChange,
  dateInputId,
}: Props) {
  const patch = (partial: Partial<SessionDatetimeParts>) =>
    onChange({ ...value, ...partial });

  return (
    <div>
      <label className={labelClassName}>{label}</label>
      <div className="grid grid-cols-3 gap-[6px]">
        <DateInput
          id={dateInputId}
          value={value.dateYmd}
          onChange={(v) => patch({ dateYmd: v })}
          className={inputClassName}
        />
        <SessionTimeOptionSelect
          inputClassName={inputClassName}
          value={value.hour24}
          options={HOUR_OPTIONS_24H}
          onChange={(hour24) => patch({ hour24 })}
        />
        <SessionTimeOptionSelect
          inputClassName={inputClassName}
          value={value.minute}
          options={MINUTE_OPTIONS}
          onChange={(minute) => patch({ minute })}
        />
      </div>
    </div>
  );
}
