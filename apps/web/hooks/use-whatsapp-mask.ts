import { useCallback, useState } from "react";
import { digitsOnly, formatBrazilPhone } from "@/src/lib/phone-format";

export { digitsOnly };
/** Alias histórico — preferir `formatBrazilPhone` em `@/src/lib/phone-format`. */
export const formatBrazilWhatsapp = formatBrazilPhone;

/**
 * Máscara de telefone BR no estilo valor formatado: estado de exibição + normalização.
 */
export function useWhatsappMask() {
  const [displayValue, setDisplayValue] = useState("");

  const initFromStored = useCallback((stored: string | null | undefined) => {
    setDisplayValue(formatBrazilPhone(stored ?? ""));
  }, []);

  const handleChange = useCallback(
    (raw: string, onValueChange: (formatted: string) => void) => {
      const d = digitsOnly(raw).slice(0, 11);
      const formatted = formatBrazilPhone(d);
      setDisplayValue(formatted);
      onValueChange(formatted);
    },
    [],
  );

  return { displayValue, setDisplayValue, handleChange, initFromStored };
}
