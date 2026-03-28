"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useDebounce } from "@/hooks/use-debounce";
import { PageShell } from "@/app/components/page-shell";
import "../projetos/projetos.css";
import { PROJECTS_PAGE_SIZE } from "@/app/(private)/projetos/constants";
import { ListSearchField } from "@/app/components/list-search-field";
import { useConfirm } from "@/app/components/confirm-provider";
import {
  TableRowActionsMenu,
  TableRowMenuDangerItem,
} from "@/app/components/table-row-actions-menu";
import type { CollaboratorDto, CollaboratorRole } from "@/app/types/collaborator";
import { CollaboratorDrawer } from "./components/collaborator-drawer";
import { COLLABORATOR_ROLE_LABEL } from "./role-labels";
import { formatBrazilPhone } from "@/src/lib/phone-format";

const EMPTY_METRICS = {
  total: 0,
  recordingTechnician: 0,
  postProduction: 0,
  mixer: 0,
  preProduction: 0,
};

function avatarColor(name: string): { bg: string; text: string } {
  const colors = [
    { bg: "#0d3d2a", text: "#5DCAA5" },
    { bg: "#0d1f3d", text: "#93C5FD" },
    { bg: "#1e1a0d", text: "#FDE68A" },
    { bg: "#1e0d3d", text: "#C4B5FD" },
    { bg: "#2a0a0a", text: "#F09595" },
  ];
  const idx = (name.charCodeAt(0) || 0) % colors.length;
  return colors[idx];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((n) => n[0]!.toUpperCase()).join("");
}

const ROLE_FILTERS: { label: string; value: "" | CollaboratorRole }[] = [
  { label: "Todas funções", value: "" },
  { label: COLLABORATOR_ROLE_LABEL.RECORDING_TECHNICIAN, value: "RECORDING_TECHNICIAN" },
  { label: COLLABORATOR_ROLE_LABEL.POST_PRODUCTION, value: "POST_PRODUCTION" },
  { label: COLLABORATOR_ROLE_LABEL.MIXER, value: "MIXER" },
  { label: COLLABORATOR_ROLE_LABEL.PRE_PRODUCTION, value: "PRE_PRODUCTION" },
];

export default function ColaboradoresPage() {
  const confirm = useConfirm();
  const router = useRouter();
  const [collaborators, setCollaborators] = useState<CollaboratorDto[]>([]);
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState<"" | CollaboratorRole>("");
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const debouncedQ = useDebounce(q, 300);

  const fetchCollaborators = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
      if (roleFilter) params.set("role", roleFilter);
      const res = await fetch(`/api/collaborators?${params.toString()}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as {
        collaborators: CollaboratorDto[];
        total: number;
        metrics?: typeof EMPTY_METRICS;
      };
      setCollaborators(data.collaborators ?? []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      setMetrics(data.metrics ?? EMPTY_METRICS);
    } catch {
      setCollaborators([]);
      setTotal(0);
      setMetrics(EMPTY_METRICS);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, page, roleFilter]);

  useEffect(() => {
    void fetchCollaborators();
  }, [fetchCollaborators]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, roleFilter]);

  const totalPages = Math.max(1, Math.ceil(total / PROJECTS_PAGE_SIZE));

  const openNew = () => setDrawerOpen(true);
  const openEdit = (c: CollaboratorDto) => router.push(`/colaboradores/${c.id}`);
  const onSaved = () => {
    setDrawerOpen(false);
    void fetchCollaborators();
  };

  const deleteCollaborator = useCallback(
    async (c: CollaboratorDto) => {
      const ok = await confirm({
        title: "Eliminar colaborador",
        description: `Confirma eliminar "${c.name}"? Esta ação não pode ser desfeita.`,
        variant: "danger",
        confirmLabel: "Sim, eliminar",
      });
      if (!ok) return;
      const res = await fetch(`/api/collaborators/${encodeURIComponent(c.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        window.alert(data.error ?? "Não foi possível eliminar o colaborador.");
        return;
      }
      void fetchCollaborators();
    },
    [confirm, fetchCollaborators],
  );

  return (
    <PageShell title="Colaboradores" subtitle={`· ${total}`} section="gestao">
      <div className="min-h-0 flex-1 overflow-y-auto px-[24px] py-[24px]">
        <div className="projects-container">
          <div className="flex flex-col gap-[8px]">
            <div className="flex items-center gap-[8px]">
              <ListSearchField
                value={q}
                onChange={setQ}
                placeholder="Buscar por nome, e-mail ou documento..."
                ariaLabel="Buscar colaboradores"
              />
              <div className="flex-1" />
              <button
                type="button"
                onClick={openNew}
                className="flex items-center gap-[6px] rounded-[6px] border border-[#0F6E56] bg-[#1D9E75] px-[14px] py-[6px] text-[12px] font-[500] text-white transition-colors hover:bg-[#0F6E56]"
              >
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 2v12M2 8h12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                Novo colaborador
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-[4px]">
              <span className="mr-[2px] text-[11px] text-[#444]">Função:</span>
              {ROLE_FILTERS.map((f) => (
                <button
                  key={f.value || "all"}
                  type="button"
                  onClick={() => {
                    setRoleFilter(f.value);
                    setPage(1);
                  }}
                  className={`rounded-[99px] border px-[10px] py-[3px] text-[11px] transition-colors ${
                    roleFilter === f.value
                      ? "border-[#333] bg-[#252525] text-[#e8e8e8]"
                      : "border-transparent text-[#505050] hover:text-[#909090]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
            }}
          >
            {[
              {
                label: "Total",
                value: metrics.total,
                sub: "colaboradores no filtro",
                cls: "",
              },
              {
                label: COLLABORATOR_ROLE_LABEL.RECORDING_TECHNICIAN,
                value: metrics.recordingTechnician,
                sub: "técnicos de gravação",
                cls: "text-[#5DCAA5]",
              },
              {
                label: COLLABORATOR_ROLE_LABEL.POST_PRODUCTION,
                value: metrics.postProduction,
                sub: "pós-produção",
                cls: "text-[#93C5FD]",
              },
              {
                label: "Outras funções",
                value: metrics.mixer + metrics.preProduction,
                sub: "mixer e pré-produção",
                cls: "text-[#FDE68A]",
              },
            ].map((kpi) => (
              <div key={kpi.label} className="projects-kpi-card">
                <div className="projects-kpi-label">{kpi.label}</div>
                <div className={`projects-kpi-value ${kpi.cls}`}>{kpi.value || "—"}</div>
                <div className="projects-kpi-sub">{kpi.sub}</div>
              </div>
            ))}
          </div>

          <div className="projects-table-card">
            {loading ? (
              <div className="flex items-center justify-center py-[48px] text-[13px] text-[#505050]">
                Carregando…
              </div>
            ) : collaborators.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-[12px] py-[60px]">
                <div className="flex h-[48px] w-[48px] items-center justify-center rounded-[10px] border border-[#2a2a2a] bg-[#1e1e1e]">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#404040"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-[500] text-[#505050]">
                    Nenhum colaborador cadastrado
                  </p>
                  <p className="mt-[4px] text-[11px] text-[#404040]">
                    Clique em &quot;Novo colaborador&quot; para começar
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openNew}
                  className="mt-[4px] flex items-center gap-[6px] rounded-[6px] border border-[#0F6E56] bg-[#1D9E75] px-[14px] py-[6px] text-[12px] font-[500] text-white transition-colors hover:bg-[#0F6E56]"
                >
                  + Novo colaborador
                </button>
              </div>
            ) : (
              <>
                <table className="projects-table">
                  <colgroup>
                    <col />
                    <col style={{ width: 180 }} />
                    <col style={{ width: 220 }} />
                    <col style={{ width: 140 }} />
                    <col style={{ width: 52 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Colaborador</th>
                      <th>Função</th>
                      <th>E-mail</th>
                      <th>WhatsApp</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {collaborators.map((c) => {
                      const colors = avatarColor(c.name);
                      const initials = getInitials(c.name);
                      return (
                        <tr key={c.id} onClick={() => openEdit(c)}>
                          <td>
                            <div className="flex items-center gap-[8px]">
                              <div
                                className="flex h-[28px] w-[28px] flex-shrink-0 items-center justify-center rounded-full text-[10px] font-[700]"
                                style={{ background: colors.bg, color: colors.text }}
                              >
                                {initials}
                              </div>
                              <div>
                                <div className="text-[13px] font-[500] text-[#e8e8e8]">{c.name}</div>
                                {(c.cpf || c.cnpj) && (
                                  <div className="text-[11px] text-[#606060]">{c.cpf ?? c.cnpj}</div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span
                              className="inline-flex rounded-[99px] border border-[#2e2e2e] bg-[#1a1a1a] px-[8px] py-[2px] text-[11px] text-[#909090]"
                            >
                              {COLLABORATOR_ROLE_LABEL[c.role]}
                            </span>
                          </td>
                          <td className="text-[11px] text-[#909090]">{c.email ?? "—"}</td>
                          <td className="text-[11px] text-[#909090]">
                            {c.whatsapp ? formatBrazilPhone(c.whatsapp) : "—"}
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div className="row-actions">
                              <TableRowActionsMenu ariaLabel={`Ações de ${c.name}`}>
                                <TableRowMenuDangerItem
                                  withBorderTop={false}
                                  onSelect={() => void deleteCollaborator(c)}
                                >
                                  Eliminar colaborador
                                </TableRowMenuDangerItem>
                              </TableRowActionsMenu>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
                      Página <span className="font-[500] text-[#909090]">{page}</span> de{" "}
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
              </>
            )}
          </div>
        </div>
      </div>

      {drawerOpen ? (
        <CollaboratorDrawer
          collaborator={null}
          onClose={() => setDrawerOpen(false)}
          onSaved={onSaved}
        />
      ) : null}
    </PageShell>
  );
}
