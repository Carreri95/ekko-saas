"use client";

import "./projetos.css";

import { PageShell } from "@/app/components/page-shell";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ProjectDrawer } from "./components/project-drawer";
import { ProjectsKpiSection } from "./components/projects-kpi-section";
import { ProjectsStatusFilters } from "./components/projects-status-filters";
import { ProjectsTable } from "./components/projects-table";
import type { ProjectMetrics } from "./lib/projetos-metrics";
import { PROJECTS_PAGE_SIZE } from "./constants";
import { useDebounce } from "@/hooks/use-debounce";
import type { DubbingProjectDto } from "./types";

const EMPTY_METRICS: ProjectMetrics = {
  totalEp: 0,
  totalMin: 0,
  totalVal: 0,
  currencyTotals: [],
  active: 0,
  paused: 0,
  late: 0,
  projectCount: 0,
};

export default function ProjetosPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<DubbingProjectDto[]>([]);
  const [metrics, setMetrics] = useState<ProjectMetrics>(EMPTY_METRICS);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [newDrawerOpen, setNewDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  /** Após a 1.ª resposta da API: evita trocar lista vazia por skeleton a cada mudança de filtro. */
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  const debouncedQ = useDebounce(q, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
      params.set("page", String(page));
      const res = await fetch(`/api/dubbing-projects?${params}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as {
        projects: DubbingProjectDto[];
        total: number;
        metrics: ProjectMetrics;
      };
      setProjects(data.projects ?? []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      setMetrics(data.metrics ?? EMPTY_METRICS);
    } catch {
      setProjects([]);
      setTotal(0);
      setMetrics(EMPTY_METRICS);
    } finally {
      setLoading(false);
      setHasFetchedOnce(true);
    }
  }, [statusFilter, debouncedQ, page]);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const totalPages = Math.max(1, Math.ceil(total / PROJECTS_PAGE_SIZE));

  const openNew = () => {
    setNewDrawerOpen(true);
  };

  const onSaved = () => {
    setNewDrawerOpen(false);
    void fetchProjects();
  };

  return (
    <PageShell
      title="Projetos"
      subtitle={`· ${total}`}
      section="gestao"
    >
      <div className="projects-body min-h-full">
        <div className="projects-container">
          <div className="flex items-center gap-[8px]">
            <div className="flex w-[260px] items-center gap-[6px] rounded-[6px] border border-[#252525] bg-[#111] px-[10px] py-[5px]">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#404040"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                className="w-full bg-transparent text-[12px] text-[#e8e8e8] outline-none placeholder:text-[#404040]"
                placeholder="Buscar por nome ou cliente..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label="Buscar projetos"
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="text-[14px] text-[#404040] hover:text-[#909090]"
                  aria-label="Limpar busca"
                >
                  ×
                </button>
              ) : null}
            </div>
            <div className="flex-1" />
            <button
              type="button"
              onClick={openNew}
              className="flex items-center gap-[6px] rounded-[6px] border border-[#0F6E56] bg-[#1D9E75] px-[14px] py-[6px] text-[12px] font-[500] text-white transition-colors hover:bg-[#0F6E56]"
            >
              <svg
                width="11"
                height="11"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden
              >
                <path
                  d="M8 2v12M2 8h12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
              Novo projeto
            </button>
          </div>

          <ProjectsStatusFilters
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
          />

          <ProjectsKpiSection metrics={metrics} />
          <div className="projects-table-card">
            <ProjectsTable
              projects={projects}
              loading={loading}
              hasFetchedOnce={hasFetchedOnce}
              emptyListDueToFilters={
                Boolean(statusFilter) || Boolean(debouncedQ.trim())
              }
              onRowClick={(p) => router.push(`/projetos/${p.id}`)}
            />
            {total > 0 ? (
              <div className="flex shrink-0 items-center justify-center gap-[16px] border-t border-[#1e1e1e] px-[16px] py-[10px] text-[11px] text-[#606060]">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-[4px] border border-[#2e2e2e] px-[10px] py-[4px] text-[11px] text-[#909090] transition-colors hover:border-[#404040] hover:text-[#e8e8e8] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="tabular-nums">
                  Página {page} de {totalPages}
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-[4px] border border-[#2e2e2e] px-[10px] py-[4px] text-[11px] text-[#909090] transition-colors hover:border-[#404040] hover:text-[#e8e8e8] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Próxima
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {newDrawerOpen ? (
        <ProjectDrawer onClose={() => setNewDrawerOpen(false)} onSaved={onSaved} />
      ) : null}
    </PageShell>
  );
}
