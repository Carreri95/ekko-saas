"use client";

import { useEffect, type CSSProperties } from "react";
import type { ValueCurrency } from "../domain";
import { useCurrencyMask } from "../hooks/use-currency-mask";

const CURRENCY_OPTIONS: { value: ValueCurrency; label: string }[] = [
  { value: "BRL", label: "BRL (R$)" },
  { value: "USD", label: "USD ($)" },
];

const LOCALE: Record<ValueCurrency, string> = {
  BRL: "pt-BR",
  USD: "en-US",
};

type Props = {
  id: string;
  value: number | undefined;
  currency: ValueCurrency;
  onValueChange: (v: number | undefined) => void;
  onCurrencyChange: (c: ValueCurrency) => void;
  error?: boolean;
  disabled?: boolean;
};

export function CurrencyValueInput({
  id,
  value,
  currency,
  onValueChange,
  onCurrencyChange,
  error = false,
  disabled = false,
}: Props) {
  const { displayValue, setDisplayValue, handleChange, initFromNumeric } =
    useCurrencyMask(currency);

  useEffect(() => {
    initFromNumeric(
      typeof value === "number" && Number.isFinite(value) ? value : undefined,
    );
  }, [value, currency, initFromNumeric]);

  const handleCurrencyChange = (c: ValueCurrency) => {
    onCurrencyChange(c);
    const v =
      typeof value === "number" && Number.isFinite(value) ? value : undefined;
    if (v !== undefined && v > 0) {
      const display = v.toLocaleString(LOCALE[c], {
        style: "currency",
        currency: c,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      setDisplayValue(display);
    }
  };

  const borderColor = error ? "#E24B4A" : "#2e2e2e";
  const focusRing = error ? "#E24B4A" : "#1D9E75";

  return (
    <div
      className="flex w-full min-h-[36px] flex-nowrap items-stretch gap-0 overflow-hidden rounded-[6px] border transition-colors focus-within:ring-1"
      style={
        {
          borderColor,
          "--tw-ring-color": focusRing,
        } as CSSProperties
      }
    >
      {/* Dropdown com seta (appearance-none + ícone) */}
      <div className="relative w-[100px] max-w-[100px] shrink-0 grow-0">
        <select
          id={`${id}-currency`}
          value={currency}
          disabled={disabled}
          onChange={(e) =>
            handleCurrencyChange(e.target.value as ValueCurrency)
          }
          className="box-border h-full min-h-[36px] w-full cursor-pointer appearance-none rounded-l-[5px] border-0 border-r border-[#2e2e2e] bg-[#111] py-[8px] pl-[10px] pr-[26px] text-[12px] text-[#e8e8e8] outline-none transition-colors focus:z-10 focus:ring-0 disabled:opacity-50"
          aria-label="Moeda"
        >
          {CURRENCY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span
          className="pointer-events-none absolute right-[6px] top-1/2 z-[1] -translate-y-1/2 text-[#707070]"
          aria-hidden
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </span>
      </div>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        disabled={disabled}
        value={displayValue}
        onChange={(e) =>
          handleChange(e.target.value, (n) => onValueChange(n ?? 0))
        }
        placeholder="0,00"
        className="box-border min-h-[36px] min-w-[12rem] flex-1 rounded-r-[5px] border-0 bg-[#111] px-[10px] py-[8px] text-[13px] font-[500] font-variant-numeric tabular-nums text-[#e8e8e8] outline-none placeholder:text-[#505050] focus:z-10 focus:ring-0 disabled:opacity-50"
        aria-label="Valor monetário"
      />
    </div>
  );
}
