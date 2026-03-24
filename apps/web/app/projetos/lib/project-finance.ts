import type { PaymentType, ValueCurrency } from "../domain";

/** Evita 1 × 500 → 500.00000000006 e totais “fantasma” por float. */
export function roundMoney2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** Valor monetário antes de persistir na API / Prisma (sempre 2 casas decimais). */
export function normalizeMoneyForStorage(n: number): number {
  return roundMoney2(n);
}

/**
 * `value` na API/BD é sempre o **total** do contrato (valor a receber no total).
 * No formulário, conforme `paymentType`, o utilizador introduz total ou taxa unitária:
 * - PER_PROJECT: total do projeto
 * - PER_EPISODE: valor **por episódio** (multiplica por episódios para obter o total)
 * - PER_MINUTE: valor **por minuto** (multiplica por minutagem para obter o total)
 */
export function formUnitToStoredTotal(
  unit: number,
  paymentType: PaymentType,
  episodes: number,
  durationMin: number,
): number {
  const u = roundMoney2(unit);
  if (paymentType === "PER_PROJECT") return u;
  if (paymentType === "PER_EPISODE") {
    const ep = Math.max(0, Math.floor(episodes));
    return roundMoney2(u * ep);
  }
  if (paymentType === "PER_MINUTE") {
    const m = Math.max(0, Math.floor(durationMin));
    return roundMoney2(u * m);
  }
  return u;
}

export function storedTotalToFormUnit(
  stored: string | null | undefined,
  paymentType: PaymentType,
  episodes: number | null | undefined,
  durationMin: number | null | undefined,
): number {
  const total =
    stored != null && stored !== "" ? Number(stored) : 0;
  if (!Number.isFinite(total)) return 0;
  if (paymentType === "PER_PROJECT") return total;
  if (paymentType === "PER_EPISODE") {
    const ep = episodes ?? 0;
    return ep > 0 ? total / ep : total;
  }
  if (paymentType === "PER_MINUTE") {
    const m = durationMin ?? 0;
    return m > 0 ? total / m : total;
  }
  return total;
}

export function valueFieldLabel(paymentType: PaymentType): string {
  switch (paymentType) {
    case "PER_PROJECT":
      return "Valor total a receber";
    case "PER_EPISODE":
      return "Valor por episódio";
    case "PER_MINUTE":
      return "Valor por minuto";
    default:
      return "Valor";
  }
}

export function formatMoneyAmount(
  amount: number,
  currency: ValueCurrency,
): string {
  if (!Number.isFinite(amount)) return "";
  return new Intl.NumberFormat(currency === "BRL" ? "pt-BR" : "en-US", {
    style: "currency",
    currency: currency === "BRL" ? "BRL" : "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/** Texto de resumo: total estimado (contrato) quando a taxa é por episódio ou por minuto. */
export function contractTotalHint(
  unit: number,
  paymentType: PaymentType,
  episodes: number,
  durationMin: number,
  currency: ValueCurrency,
): string | null {
  if (unit <= 0) return null;
  if (paymentType === "PER_PROJECT") return null;
  const total = formUnitToStoredTotal(unit, paymentType, episodes, durationMin);
  if (total <= 0) return null;
  return `Total do contrato: ${formatMoneyAmount(total, currency)}`;
}
