/** Mantém apenas dígitos (útil para máscaras e validação). */
export function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

/**
 * Formata telefone brasileiro em tempo real: DDD + 8 dígitos (fixo) ou 9 (celular).
 * Aceita string com ou sem máscara; usa no máximo 11 dígitos (DDD + número).
 */
/**
 * Valor persistido na BD: só dígitos (BR até 11: DDD + número).
 * `null` se não houver dígitos.
 */
export function normalizePhoneForStorage(
  input: string | null | undefined,
): string | null {
  const d = digitsOnly(input ?? "").slice(0, 11);
  return d.length === 0 ? null : d;
}

export function formatBrazilPhone(input: string): string {
  const d = digitsOnly(input).slice(0, 11);
  if (d.length === 0) return "";
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);

  if (d.length <= 2) {
    return d.length === 1 ? `(${d}` : `(${ddd})`;
  }
  if (d.length <= 6) {
    return `(${ddd}) ${rest}`;
  }
  if (d.length === 11) {
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }
  return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}
