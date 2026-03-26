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
import { ListSearchField } from "@/app/components/list-search-field";
import { useConfirm } from "@/app/components/confirm-provider";
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
  const confirm = useConfirm();
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

  const deleteProject = useCallback(
    async (p: DubbingProjectDto) => {
      const ok = await confirm({
        title: "Eliminar projeto",
        description: `Confirma eliminar "${p.name}"? Esta ação não pode ser desfeita.`,
        variant: "danger",
        confirmLabel: "Sim, eliminar",
      });
      if (!ok) return;
      const res = await fetch(
        `/api/dubbing-projects/${encodeURIComponent(p.id)}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        window.alert(data.error ?? "Não foi possível eliminar o projeto.");
        return;
      }
      void fetchProjects();
    },
    [confirm, fetchProjects],
  );

  return (
    <PageShell
      title="Projetos"
      subtitle={`· ${total}`}
      section="gestao"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-[24px] py-[24px]">
        <div className="projects-container">
          <div className="flex items-center gap-[8px]">
            <ListSearchField
              value={q}
              onChange={setQ}
              placeholder="Buscar por nome ou cliente..."
              ariaLabel="Buscar projetos"
            />
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
              onDeleteProject={deleteProject}
            />
            {total > 0 ? (
              <div className="flex shrink-0 items-center justify-center gap-[12px] border-t border-[#1e1e1e] bg-[#141414] px-[16px] py-[10px]">
                <button
                  type="button"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="flex items-center gap-[4px] rounded-[5px] border border-[#2e2e2e] bg-[#1a1a1a] px-[10px] py-[5px] text-[11px] text-[#606060] transition-colors hover:border-[#404040] hover:bg-[#252525] hover:text-[#e8e8e8] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  ← Anterior
                </button>
                <span className="text-[11px] tabular-nums text-[#505050]">
                  Página <span className="font-[500] text-[#909090]">{page}</span>
                  {" "}de{" "}
                  <span className="font-[500] text-[#909090]">{totalPages}</span>
                </span>
                <button
                  type="button"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex items-center gap-[4px] rounded-[5px] border border-[#2e2e2e] bg-[#1a1a1a] px-[10px] py-[5px] text-[11px] text-[#606060] transition-colors hover:border-[#404040] hover:bg-[#252525] hover:text-[#e8e8e8] disabled:cursor-not-allowed disabled:opacity-30"
                >
                  Próxima →
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
