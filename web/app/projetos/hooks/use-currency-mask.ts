import { useCallback, useState } from "react";
import type { ValueCurrency } from "../domain";
import { roundMoney2 } from "../lib/project-finance";

const LOCALE: Record<ValueCurrency, string> = {
  BRL: "pt-BR",
  USD: "en-US",
};

/**
 * Formata número como moeda em tempo real (entrada em “centavos”).
 * Retorna texto para exibição e número normalizado para o formulário.
 */
export function useCurrencyMask(currency: ValueCurrency) {
  const [displayValue, setDisplayValue] = useState("");

  const format = useCallback(
    (raw: string): { display: string; numeric: number | undefined } => {
      const digits = raw.replace(/\D/g, "");
      if (!digits || digits === "0") {
        return { display: "", numeric: undefined };
      }
      const numeric = parseInt(digits, 10) / 100;
      const display = numeric.toLocaleString(LOCALE[currency], {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      return { display, numeric: roundMoney2(numeric) };
    },
    [currency],
  );

  const handleChange = useCallback(
    (raw: string, onNumericChange: (v: number | undefined) => void) => {
      const { display, numeric } = format(raw);
      setDisplayValue(display);
      onNumericChange(numeric);
    },
    [format],
  );

  const initFromNumeric = useCallback(
    (numeric: number | undefined) => {
      if (numeric === undefined || numeric === null || numeric <= 0) {
        setDisplayValue("");
        return;
      }
      const n = roundMoney2(numeric);
      const display = n.toLocaleString(LOCALE[currency], {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      setDisplayValue(display);
    },
    [currency],
  );

  return { displayValue, setDisplayValue, handleChange, initFromNumeric };
}
