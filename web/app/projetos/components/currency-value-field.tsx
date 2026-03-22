"use client";

import type { ValueCurrency } from "../domain";
import { CurrencyValueInput } from "./currency-value-input";

type Props = {
  id: string;
  value: number;
  onChange: (n: number) => void;
  currency: ValueCurrency;
  onCurrencyChange: (c: ValueCurrency) => void;
  error?: boolean;
  inputCls: string;
  inputErrCls: string;
  disabled?: boolean;
};

/**
 * Valor com escolha BRL/USD e máscara monetária em tempo real.
 * O valor enviado ao formulário é sempre número (normalizado no hook / submit).
 */
export function CurrencyValueField({
  id,
  value,
  onChange,
  currency,
  onCurrencyChange,
  error,
  inputCls: _inputCls,
  inputErrCls: _inputErrCls,
  disabled,
}: Props) {
  return (
    <div className="w-full min-w-0">
      <CurrencyValueInput
        id={id}
        value={Number.isFinite(value) ? value : undefined}
        currency={currency}
        onValueChange={(v) => onChange(v ?? 0)}
        onCurrencyChange={onCurrencyChange}
        error={error}
        disabled={disabled}
      />
    </div>
  );
}
