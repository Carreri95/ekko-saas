import type { ValueCurrency } from "../domain";
import type { DubbingProjectDto } from "../types";
import { roundMoney2 } from "./project-finance";

export type CurrencyTotal = {
  currency: ValueCurrency;
  symbol: string;
  total: number;
};

/** Campos mínimos para KPIs (lista completa filtrada, não só a página atual). */
export type ProjectMetricsSource = Pick<
  DubbingProjectDto,
  | "episodes"
  | "durationMin"
  | "value"
  | "valueCurrency"
  | "status"
  | "deadline"
>;

export type ProjectMetrics = {
  totalEp: number;
  totalMin: number;
  /** Soma bruta de valores (mistura moedas; não usar para exibição quando há várias). */
  totalVal: number;
  currencyTotals: CurrencyTotal[];
  active: number;
  paused: number;
  late: number;
  projectCount: number;
};

export function computeCurrencyTotals(
  projects: ReadonlyArray<Pick<DubbingProjectDto, "value" | "valueCurrency">>,
): CurrencyTotal[] {
  const acc: Partial<Record<ValueCurrency, number>> = {};
  for (const p of projects) {
    const v = Number(p.value ?? 0);
    if (!Number.isFinite(v) || v <= 0) continue;
    const c = (p.valueCurrency ?? "BRL") as ValueCurrency;
    acc[c] = (acc[c] ?? 0) + v;
  }
  return (Object.entries(acc) as [ValueCurrency, number][])
    .map(([currency, total]) => ({
      currency,
      symbol: currency === "BRL" ? "R$" : "$",
      total: roundMoney2(total),
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export function computeProjectMetrics(
  projects: readonly ProjectMetricsSource[],
): ProjectMetrics {
  const totalEp = projects.reduce((s, p) => s + (p.episodes ?? 0), 0);
  const totalMin = projects.reduce((s, p) => s + (p.durationMin ?? 0), 0);
  const totalVal = projects.reduce((s, p) => s + Number(p.value ?? 0), 0);
  const currencyTotals = computeCurrencyTotals(projects);
  const active = projects.filter(
    (p) => p.status !== "PAUSED" && p.status !== "DONE",
  ).length;
  const paused = projects.filter((p) => p.status === "PAUSED").length;
  const late = projects.filter((p) => {
    if (!p.deadline) return false;
    return new Date(p.deadline).getTime() < Date.now();
  }).length;

  return {
    totalEp,
    totalMin,
    totalVal,
    currencyTotals,
    active,
    paused,
    late,
    projectCount: projects.length,
  };
}

export function formatReceita(v: number): string {
  if (v <= 0) return "—";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
