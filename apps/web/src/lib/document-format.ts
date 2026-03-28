export function digitsOnly(input: string): string {
  return input.replace(/\D/g, "");
}

export function normalizeCpfForStorage(input: string | null | undefined): string | null {
  const digits = digitsOnly(input ?? "");
  if (digits.length !== 11) return null;
  return digits;
}

export function normalizeCnpjForStorage(input: string | null | undefined): string | null {
  const digits = digitsOnly(input ?? "");
  if (digits.length !== 14) return null;
  return digits;
}

export function formatCpf(input: string): string {
  const d = digitsOnly(input).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatCnpj(input: string): string {
  const d = digitsOnly(input).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}
