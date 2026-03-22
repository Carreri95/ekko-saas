import type { ProjectMetrics } from "../lib/projetos-metrics";
import { KpiCard } from "./kpi-card";

type Props = {
  metrics: ProjectMetrics;
};

export function ProjectsKpiSection({ metrics }: Props) {
  const {
    active,
    paused,
    totalEp,
    totalMin,
    late,
    projectCount,
    currencyTotals,
  } = metrics;

  const receitaSub =
    late > 0 ? (
      <span style={{ color: "#F09595" }}>
        {late} projeto{late !== 1 ? "s" : ""} atrasado
        {late !== 1 ? "s" : ""}
      </span>
    ) : (
      "nos projetos ativos"
    );

  return (
    <div className="projects-kpi-grid">
      <KpiCard
        label="Projetos ativos"
        value={active || "—"}
        sub={
          paused > 0
            ? `${paused} pausado${paused !== 1 ? "s" : ""}`
            : "nenhum pausado"
        }
      />
      <KpiCard
        label="Episódios"
        value={totalEp > 0 ? totalEp : "—"}
        sub={`em ${projectCount} projeto${projectCount !== 1 ? "s" : ""}`}
      />
      <KpiCard
        label="Minutagem total"
        value={totalMin > 0 ? totalMin.toLocaleString("pt-BR") : "—"}
        sub="minutos"
      />
      <KpiCard
        label="Receita prevista"
        currencyTotals={
          currencyTotals.length > 0 ? currencyTotals : undefined
        }
        value="—"
        valueClassName="projects-kpi-value--green"
        sub={receitaSub}
      />
    </div>
  );
}
