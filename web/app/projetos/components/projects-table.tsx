"use client";

import type { DubbingProjectDto } from "../types";
import type { DubbingProjectStatus } from "../domain";
import { formatMoneyAmount } from "../lib/project-finance";

/** Pílula como em projects-page-reference.html (fundo rgba + borda + dot) */
const STATUS_PILL: Record<
  DubbingProjectStatus,
  { label: string; dot: string; border: string; bg: string; text: string }
> = {
  SPOTTING: {
    label: "Spotting",
    dot: "#5B9BD5",
    border: "#5B9BD5",
    bg: "rgba(91,155,213,0.12)",
    text: "#8BB4E5",
  },
  ADAPTATION: {
    label: "Adaptação",
    dot: "#BA7517",
    border: "#BA7517",
    bg: "rgba(186,117,23,0.12)",
    text: "#E5A84A",
  },
  REVIEW: {
    label: "Revisão",
    dot: "#A78BFA",
    border: "#A78BFA",
    bg: "rgba(167,139,250,0.12)",
    text: "#C4B0FC",
  },
  RECORDING: {
    label: "Em gravação",
    dot: "#1D9E75",
    border: "#1D9E75",
    bg: "rgba(29,158,117,0.12)",
    text: "#5DCAA5",
  },
  DELIVERY: {
    label: "Entrega",
    dot: "#FBBF24",
    border: "#FBBF24",
    bg: "rgba(251,191,36,0.12)",
    text: "#FCD34D",
  },
  DONE: {
    label: "Concluído",
    dot: "#4ade80",
    border: "#4ade80",
    bg: "rgba(74,222,128,0.12)",
    text: "#86EFAC",
  },
  PAUSED: {
    label: "Pausado",
    dot: "#555555",
    border: "#555555",
    bg: "rgba(85,85,85,0.18)",
    text: "#909090",
  },
};

type Props = {
  projects: DubbingProjectDto[];
  loading: boolean;
  /** Se false, `loading` mostra skeleton (carregamento inicial). Se true, recargas não substituem a área por skeleton. */
  hasFetchedOnce?: boolean;
  emptyListDueToFilters?: boolean;
  onRowClick: (p: DubbingProjectDto) => void;
  onOpenNew?: () => void;
};

function TableSkeleton({ rows }: { rows: number }) {
  return (
    <div className="space-y-3" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-[40px] animate-pulse rounded-[4px] bg-[#1e1e1e]"
        />
      ))}
    </div>
  );
}

function EmptyList({
  dueToFilters,
  onOpenNew,
}: {
  dueToFilters: boolean;
  onOpenNew?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <p className="text-[13px] text-[#909090]">
        {dueToFilters
          ? "Nenhum projeto corresponde aos filtros."
          : "Nenhum projeto ainda."}
      </p>
      {!dueToFilters && onOpenNew ? (
        <button
          type="button"
          onClick={onOpenNew}
          className="rounded-[6px] border border-[#0F6E56] bg-[#1D9E75] px-[16px] py-[8px] text-[12px] font-[500] text-white transition-colors hover:bg-[#0F6E56]"
        >
          Novo projeto
        </button>
      ) : null}
    </div>
  );
}

function StatusBadge({ status }: { status: DubbingProjectStatus }) {
  const b = STATUS_PILL[status] ?? {
    label: String(status),
    dot: "#606060",
    border: "#606060",
    bg: "rgba(96,96,96,0.15)",
    text: "#909090",
  };
  return (
    <span
      className="status-pill"
      style={{
        background: b.bg,
        border: `0.5px solid ${b.border}`,
        color: b.text,
      }}
    >
      <span
        className="status-pill-dot"
        style={{ background: b.dot }}
      />
      {b.label}
    </span>
  );
}

function DeadlineCell({ deadline }: { deadline: string | null }) {
  if (!deadline) {
    return <span className="proj-deadline-ok">—</span>;
  }
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) {
    return <span className="proj-deadline-ok">{deadline}</span>;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dd = new Date(d);
  dd.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((dd.getTime() - today.getTime()) / 86400000);
  const cls =
    diffDays < 0 ? "proj-deadline-late" : diffDays <= 3 ? "proj-deadline-warn" : "proj-deadline-ok";
  const fmt = d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return <span className={cls}>{fmt}</span>;
}

export function ProjectsTable({
  projects,
  loading,
  hasFetchedOnce = false,
  emptyListDueToFilters = false,
  onRowClick,
  onOpenNew,
}: Props) {
  const showInitialSkeleton = loading && !hasFetchedOnce;

  if (showInitialSkeleton) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto py-4">
        <TableSkeleton rows={6} />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div
        className={`min-h-0 flex-1 overflow-y-auto py-4 transition-opacity duration-150 ${
          loading ? "opacity-60" : ""
        }`}
        aria-busy={loading}
      >
        <EmptyList dueToFilters={emptyListDueToFilters} onOpenNew={onOpenNew} />
      </div>
    );
  }

  return (
    <div
      className={`min-h-0 flex-1 overflow-y-auto transition-opacity duration-150 ${
        loading ? "opacity-60" : ""
      }`}
      aria-busy={loading}
    >
      <table className="projects-table">
        <colgroup>
          <col />
          <col className="col-status" />
          <col className="col-ep" />
          <col className="col-min" />
          <col className="col-prazo" />
          <col className="col-valor" />
          <col className="col-acoes" />
        </colgroup>
        <thead>
          <tr>
            <th>Projeto</th>
            <th className="th-center">Status</th>
            <th className="th-center">Episódios</th>
            <th className="th-right">Minutagem</th>
            <th>Prazo</th>
            <th className="th-right">Valor</th>
            <th className="th-actions" aria-hidden />
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr key={p.id} onClick={() => onRowClick(p)}>
              <td className="td-project">
                <div className="proj-cell-name">{p.name}</div>
                {p.client ? (
                  <div className="proj-cell-client">{p.client}</div>
                ) : null}
              </td>
              <td className="td-status">
                <StatusBadge status={p.status} />
              </td>
              <td
                className="td-center td-numeric"
                style={{ color: "#909090" }}
              >
                {p.episodes != null && p.episodes > 0 ? `${p.episodes} ep` : "—"}
              </td>
              <td
                className="td-right td-numeric"
                style={{ color: "#909090" }}
              >
                {p.durationMin != null && p.durationMin > 0
                  ? `${p.durationMin} min`
                  : "—"}
              </td>
              <td className="td-prazo">
                <DeadlineCell deadline={p.deadline} />
              </td>
              <td
                className="td-right td-numeric"
                style={{ color: "#e8e8e8", fontWeight: 500 }}
              >
                {p.value != null && Number(p.value) > 0
                  ? formatMoneyAmount(
                      Number(p.value),
                      p.valueCurrency ?? "BRL",
                    )
                  : "—"}
              </td>
              <td onClick={(e) => e.stopPropagation()}>
                <div className="row-actions">
                  <button
                    type="button"
                    className="flex h-[24px] w-[24px] items-center justify-center rounded-[4px] border border-[#2e2e2e] text-[14px] text-[#606060] hover:bg-[#252525] hover:text-[#e8e8e8]"
                    aria-label="Mais opções"
                    onClick={(e) => {
                      e.stopPropagation();
                      // TODO: menu de contexto
                    }}
                  >
                    ⋯
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
