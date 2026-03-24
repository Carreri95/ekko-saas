"use client";

import { useState, type ReactNode } from "react";
import type { CurrencyTotal } from "../lib/projetos-metrics";

type KpiCardProps = {
  label: string;
  value?: ReactNode;
  sub?: ReactNode;
  valueClassName?: string;
  currencyTotals?: CurrencyTotal[];
};

const CURRENCY_STYLES: Record<
  string,
  { active: string; text: string; val: string }
> = {
  BRL: {
    active: "bg-[#0d3d2a] border-[#0F6E56] text-[#5DCAA5]",
    text: "R$ BRL",
    val: "text-[#5DCAA5]",
  },
  USD: {
    active: "bg-[#0d1f3d] border-[#1e4a7a] text-[#93C5FD]",
    text: "$ USD",
    val: "text-[#93C5FD]",
  },
};

export function KpiCard({
  label,
  value,
  sub,
  valueClassName,
  currencyTotals,
}: KpiCardProps) {
  const [picked, setPicked] = useState<string | null>(null);

  if (currencyTotals && currencyTotals.length > 0) {
    const selected =
      currencyTotals.find((c) => c.currency === picked) ?? currencyTotals[0];
    const styles = CURRENCY_STYLES[selected.currency] ?? CURRENCY_STYLES.BRL;

    return (
      <div className="projects-kpi-card">
        <div className="projects-kpi-label">{label}</div>
        <div className={`projects-kpi-value ${styles.val}`}>
          {selected.symbol}{" "}
          {selected.total.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </div>
        {sub ? <div className="projects-kpi-sub">{sub}</div> : null}
        {currencyTotals.length > 1 ? (
          <div className="mt-[8px] flex flex-wrap gap-[4px]">
            {currencyTotals.map((c) => {
              const cs = CURRENCY_STYLES[c.currency] ?? CURRENCY_STYLES.BRL;
              const isActive = c.currency === selected.currency;
              return (
                <button
                  key={c.currency}
                  type="button"
                  onClick={() => setPicked(c.currency)}
                  className={`rounded-[99px] border px-[7px] py-[1px] text-[9px] font-[600] transition-colors ${
                    isActive
                      ? cs.active
                      : "border-[#252525] text-[#444] hover:border-[#333] hover:text-[#606060]"
                  }`}
                >
                  {cs.text}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="projects-kpi-card">
      <div className="projects-kpi-label">{label}</div>
      <div
        className={
          valueClassName
            ? `projects-kpi-value ${valueClassName}`
            : "projects-kpi-value"
        }
      >
        {value}
      </div>
      {sub ? <div className="projects-kpi-sub">{sub}</div> : null}
    </div>
  );
}
