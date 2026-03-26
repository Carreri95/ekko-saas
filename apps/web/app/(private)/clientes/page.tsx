"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "../projetos/projetos.css";
import { PROJECTS_PAGE_SIZE } from "@/app/(private)/projetos/constants";
import { PageShell } from "@/app/components/page-shell";
import { KpiCard } from "@/app/(private)/projetos/components/kpi-card";
import type { CurrencyTotal } from "@/app/(private)/projetos/lib/projetos-metrics";
import { useDebounce } from "@/hooks/use-debounce";
import { ListSearchField } from "@/app/components/list-search-field";
import { useConfirm } from "@/app/components/confirm-provider";
import {
  TableRowActionsMenu,
  TableRowMenuDangerItem,
} from "@/app/components/table-row-actions-menu";
import { ClientDrawer } from "./components/client-drawer";
import type { ClientDto } from "@/app/types/client";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
};

const STATUS_BADGE_STYLE: Record<
  string,
  { bg: string; border: string; text: string; dot: string }
> = {
  ACTIVE: {
    bg: "rgba(29,158,117,0.12)",
    border: "#1D9E75",
    text: "#5DCAA5",
    dot: "#1D9E75",
  },
  INACTIVE: {
    bg: "#1e1e1e",
    border: "#2e2e2e",
    text: "#505050",
    dot: "#444",
  },
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

const EMPTY_KPIS = {
  currencyTotals: [] as CurrencyTotal[],
  projectsLinked: 0,
  activeCount: 0,
  total: 0,
};

export default function ClientesPage() {
  const confirm = useConfirm();
  const router = useRouter();
  const [clients, setClients] = useState<ClientDto[]>([]);
  const [kpis, setKpis] = useState(EMPTY_KPIS);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const debouncedQ = useDebounce(q, 300);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
      params.set("page", String(page));
      const res = await fetch(`/api/clients?${params}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as {
        clients: ClientDto[];
        total: number;
        kpis?: typeof EMPTY_KPIS;
      };
      setClients(data.clients ?? []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      setKpis(data.kpis ?? EMPTY_KPIS);
    } catch {
      setClients([]);
      setTotal(0);
      setKpis(EMPTY_KPIS);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedQ, page]);

  useEffect(() => {
    void fetchClients();
  }, [fetchClients]);

  const totalPages = Math.max(1, Math.ceil(total / PROJECTS_PAGE_SIZE));

  const openNew = () => setDrawerOpen(true);
  const openEdit = (c: ClientDto) => router.push(`/clientes/${c.id}`);
  const onSaved = () => {
    setDrawerOpen(false);
    void fetchClients();
  };

  const deleteClient = useCallback(
    async (c: ClientDto) => {
      const ok = await confirm({
        title: "Eliminar cliente",
        description: `Confirma eliminar "${c.name}"? Esta ação não pode ser desfeita.`,
        variant: "danger",
        confirmLabel: "Sim, eliminar",
      });
      if (!ok) return;
      const res = await fetch(`/api/clients/${encodeURIComponent(c.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        window.alert(data.error ?? "Não foi possível eliminar o cliente.");
        return;
      }
      void fetchClients();
    },
    [confirm, fetchClients],
  );

  const STATUS_FILTERS = [
    { label: "Todos", value: "" },
    { label: "Ativo", value: "ACTIVE" },
    { label: "Inativo", value: "INACTIVE" },
  ];

  return (
    <PageShell title="Clientes" subtitle={`· ${total}`} section="gestao">
      <div className="min-h-0 flex-1 overflow-y-auto px-[24px] py-[24px]">
        <div className="projects-container">
          <div className="flex flex-col gap-[8px]">
            <div className="flex items-center gap-[8px]">
              <ListSearchField
                value={q}
                onChange={setQ}
                placeholder="Buscar por nome ou e-mail..."
                ariaLabel="Buscar clientes"
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
                Novo cliente
              </button>
            </div>
            <div className="flex items-center gap-[4px]">
              <span className="mr-[2px] text-[11px] text-[#444]">Status:</span>
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value || "all"}
                  type="button"
                  onClick={() => {
                    setStatusFilter(f.value);
                    setPage(1);
                  }}
                  className={`rounded-[99px] border px-[10px] py-[3px] text-[11px] transition-colors ${
                    statusFilter === f.value
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
              gridTemplateColumns: "repeat(4,1fr)",
              gap: 12,
            }}
          >
            {[
              {
                label: "Total de clientes",
                display: String(kpis.total),
                sub: "cadastrados",
                cls: "",
              },
              {
                label: "Ativos",
                display: String(kpis.activeCount),
                sub: "em operação",
                cls: "text-[#5DCAA5]",
              },
              {
                label: "Projetos vinculados",
                display: String(kpis.projectsLinked),
                sub: "nos clientes filtrados",
                cls: "text-[#EF9F27]",
              },
            ].map((kpi) => (
              <div key={kpi.label} className="projects-kpi-card">
                <div className="projects-kpi-label">{kpi.label}</div>
                <div className={`projects-kpi-value ${kpi.cls}`}>
                  {kpi.display}
                </div>
                <div className="projects-kpi-sub">{kpi.sub}</div>
              </div>
            ))}
            <KpiCard
              label="Receita (projetos)"
              sub="soma global"
              currencyTotals={
                kpis.currencyTotals.length > 0 ? kpis.currencyTotals : undefined
              }
              value={kpis.currencyTotals.length > 0 ? undefined : "—"}
            />
          </div>

          <div className="projects-table-card">
            {loading ? (
              <div className="flex items-center justify-center py-[48px] text-[13px] text-[#505050]">
                Carregando…
              </div>
            ) : clients.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-[12px] py-[60px]">
                <div className="flex h-[48px] w-[48px] items-center justify-center rounded-[10px] border border-[#2a2a2a] bg-[#1e1e1e]">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#404040"
                    strokeWidth="1.5"
                  >
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-[13px] font-[500] text-[#505050]">
                    Nenhum cliente cadastrado
                  </p>
                  <p className="mt-[4px] text-[11px] text-[#404040]">
                    Clique em &quot;Novo cliente&quot; para começar
                  </p>
                </div>
                <button
                  onClick={openNew}
                  className="mt-[4px] flex items-center gap-[6px] rounded-[6px] border border-[#0F6E56] bg-[#1D9E75] px-[14px] py-[6px] text-[12px] font-[500] text-white transition-colors hover:bg-[#0F6E56]"
                >
                  + Novo cliente
                </button>
              </div>
            ) : (
              <>
                <table className="projects-table">
                  <colgroup>
                    <col />
                    <col style={{ width: 200 }} />
                    <col style={{ width: 130 }} />
                    <col style={{ width: 110 }} />
                    <col style={{ width: 90 }} />
                    <col style={{ width: 52 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>E-mail</th>
                      <th>Telefone</th>
                      <th>Status</th>
                      <th className="th-center">Projetos</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c) => {
                    const st =
                      STATUS_BADGE_STYLE[c.status] ?? STATUS_BADGE_STYLE.INACTIVE;
                    const colors = avatarColor(c.name);
                    const initials = getInitials(c.name);
                    return (
                      <tr key={c.id} onClick={() => openEdit(c)}>
                        <td>
                          <div className="flex items-center gap-[8px]">
                            <div
                              className="flex h-[28px] w-[28px] flex-shrink-0 items-center justify-center rounded-[4px] text-[10px] font-[700]"
                              style={{ background: colors.bg, color: colors.text }}
                            >
                              {initials}
                            </div>
                            <div>
                              <div className="text-[13px] font-[500] text-[#e8e8e8]">
                                {c.name}
                              </div>
                              {c.country ? (
                                <div className="text-[11px] text-[#606060]">
                                  {c.country}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="text-[11px] text-[#909090]">
                          {c.email ?? "—"}
                        </td>
                        <td className="text-[11px] text-[#909090]">
                          {c.phone ?? "—"}
                        </td>
                        <td>
                          <span
                            className="inline-flex items-center gap-[4px] rounded-[99px] px-[8px] py-[2px] text-[11px] font-[500]"
                            style={{
                              background: st.bg,
                              border: `0.5px solid ${st.border}`,
                              color: st.text,
                            }}
                          >
                            <span
                              className="h-[5px] w-[5px] flex-shrink-0 rounded-full"
                              style={{ background: st.dot }}
                            />
                            {STATUS_LABEL[c.status] ?? c.status}
                          </span>
                        </td>
                        <td className="td-center text-[#909090]">
                          {c.projectCount ?? 0}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="row-actions">
                            <TableRowActionsMenu
                              ariaLabel={`Ações do cliente ${c.name}`}
                            >
                              <TableRowMenuDangerItem
                                withBorderTop={false}
                                onSelect={() => deleteClient(c)}
                              >
                                Eliminar cliente
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
              </>
            )}
          </div>
        </div>
      </div>

      {drawerOpen ? (
        <ClientDrawer
          onClose={() => setDrawerOpen(false)}
          onSaved={onSaved}
        />
      ) : null}
    </PageShell>
  );
}
