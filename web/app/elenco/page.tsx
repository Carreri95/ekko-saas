"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import "../projetos/projetos.css";
import { PROJECTS_PAGE_SIZE } from "@/app/projetos/constants";
import { PageShell } from "@/app/components/page-shell";
import { useDebounce } from "@/hooks/use-debounce";
import { CastMemberDrawer } from "./components/cast-member-drawer";
import type { CastMemberDto } from "@/app/types/cast-member";
import { formatBrazilPhone } from "@/src/lib/phone-format";

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Disponível",
  BUSY: "Em projeto",
  INACTIVE: "Inativo",
};

const STATUS_STYLE: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  AVAILABLE: {
    bg: "rgba(29,158,117,0.12)",
    border: "#1D9E75",
    text: "#5DCAA5",
    dot: "#1D9E75",
  },
  BUSY: {
    bg: "rgba(186,117,23,0.12)",
    border: "#BA7517",
    text: "#EF9F27",
    dot: "#BA7517",
  },
  INACTIVE: { bg: "#1e1e1e", border: "#2e2e2e", text: "#505050", dot: "#444" },
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

const EMPTY_METRICS = {
  total: 0,
  available: 0,
  busy: 0,
  specialtyKinds: 0,
};

export default function ElencoPage() {
  const router = useRouter();
  const [members, setMembers] = useState<CastMemberDto[]>([]);
  const [metrics, setMetrics] = useState(EMPTY_METRICS);
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

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (debouncedQ.trim()) params.set("q", debouncedQ.trim());
      params.set("page", String(page));
      const res = await fetch(`/api/cast-members?${params}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as {
        members: CastMemberDto[];
        total: number;
        metrics?: typeof EMPTY_METRICS;
      };
      setMembers(data.members ?? []);
      setTotal(typeof data.total === "number" ? data.total : 0);
      setMetrics(data.metrics ?? EMPTY_METRICS);
    } catch {
      setMembers([]);
      setTotal(0);
      setMetrics(EMPTY_METRICS);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedQ, page]);

  useEffect(() => {
    void fetchMembers();
  }, [fetchMembers]);

  const totalPages = Math.max(1, Math.ceil(total / PROJECTS_PAGE_SIZE));

  const openNew = () => {
    setDrawerOpen(true);
  };
  const openEdit = (m: CastMemberDto) => {
    router.push(`/elenco/${m.id}`);
  };
  const onSaved = () => {
    setDrawerOpen(false);
    void fetchMembers();
  };

  const STATUS_FILTERS = [
    { label: "Todos", value: "" },
    { label: "Disponível", value: "AVAILABLE" },
    { label: "Em projeto", value: "BUSY" },
    { label: "Inativo", value: "INACTIVE" },
  ];

  return (
    <PageShell title="Elenco" subtitle={`· ${total}`} section="gestao">
      <div className="min-h-0 flex-1 overflow-y-auto px-[24px] py-[24px]">
        <div className="projects-container">
          <div className="flex flex-col gap-[8px]">
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
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  className="w-full bg-transparent text-[12px] text-[#e8e8e8] outline-none placeholder:text-[#404040]"
                  placeholder="Buscar por nome ou especialidade..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                {q ? (
                  <button
                    type="button"
                    onClick={() => setQ("")}
                    className="text-[14px] text-[#404040] hover:text-[#909090]"
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
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M8 2v12M2 8h12"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
                Novo dublador
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

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
            {[
              {
                label: "Total no elenco",
                value: metrics.total,
                sub: "dubladores cadastrados",
                cls: "",
              },
              {
                label: "Disponíveis",
                value: metrics.available,
                sub: "prontos para projetos",
                cls: "text-[#5DCAA5]",
              },
              {
                label: "Em projeto",
                value: metrics.busy,
                sub: "ocupados agora",
                cls: "text-[#EF9F27]",
              },
              {
                label: "Especialidades",
                value: metrics.specialtyKinds,
                sub: "tipos de voz cadastrados",
                cls: "",
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
            ) : members.length === 0 ? (
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
                    Nenhum dublador cadastrado
                  </p>
                  <p className="mt-[4px] text-[11px] text-[#404040]">
                    Clique em &quot;Novo dublador&quot; para começar
                  </p>
                </div>
                <button
                  onClick={openNew}
                  className="mt-[4px] flex items-center gap-[6px] rounded-[6px] border border-[#0F6E56] bg-[#1D9E75] px-[14px] py-[6px] text-[12px] font-[500] text-white transition-colors hover:bg-[#0F6E56]"
                >
                  + Novo dublador
                </button>
              </div>
            ) : (
              <>
                <table className="projects-table">
                  <colgroup>
                    <col />
                    <col style={{ width: 130 }} />
                    <col style={{ width: 220 }} />
                    <col style={{ width: 140 }} />
                    <col style={{ width: 90 }} />
                    <col style={{ width: 52 }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Dublador</th>
                      <th>Status</th>
                      <th>Especialidades</th>
                      <th>WhatsApp</th>
                      <th className="th-center">Projetos</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => {
                    const s = STATUS_STYLE[m.status] ?? STATUS_STYLE.INACTIVE;
                    const colors = avatarColor(m.name);
                    const initials = getInitials(m.name);
                    return (
                      <tr key={m.id} onClick={() => openEdit(m)}>
                        <td>
                          <div className="flex items-center gap-[8px]">
                            <div
                              className="flex h-[28px] w-[28px] flex-shrink-0 items-center justify-center rounded-full text-[10px] font-[700]"
                              style={{ background: colors.bg, color: colors.text }}
                            >
                              {initials}
                            </div>
                            <div>
                              <div className="text-[13px] font-[500] text-[#e8e8e8]">{m.name}</div>
                              {m.role ? (
                                <div className="text-[11px] text-[#606060]">{m.role}</div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span
                            className="inline-flex items-center gap-[4px] rounded-[99px] px-[8px] py-[2px] text-[11px] font-[500]"
                            style={{
                              background: s.bg,
                              border: `0.5px solid ${s.border}`,
                              color: s.text,
                            }}
                          >
                            <span
                              className="h-[5px] w-[5px] flex-shrink-0 rounded-full"
                              style={{ background: s.dot }}
                            />
                            {STATUS_LABEL[m.status]}
                          </span>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-[3px]">
                            {m.specialties.slice(0, 2).map((sp) => (
                              <span
                                key={sp}
                                className="rounded-[3px] bg-[#252525] px-[5px] py-[1px] text-[10px] text-[#707070]"
                              >
                                {sp}
                              </span>
                            ))}
                            {m.specialties.length > 2 ? (
                              <span className="rounded-[3px] bg-[#252525] px-[5px] py-[1px] text-[10px] text-[#505050]">
                                +{m.specialties.length - 2}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="text-[11px] text-[#909090]">
                          {m.whatsapp
                            ? formatBrazilPhone(m.whatsapp)
                            : "—"}
                        </td>
                        <td className="td-center">
                          {(m.activeProjectCount ?? 0) > 0 ? (
                            <span
                              className="font-[500]"
                              style={{
                                color:
                                  m.activeProjectCount === 1
                                    ? "#EF9F27"
                                    : "#5DCAA5",
                              }}
                            >
                              {m.activeProjectCount}
                            </span>
                          ) : (
                            <span className="text-[#444]">—</span>
                          )}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div className="row-actions">
                            <button
                              type="button"
                              aria-label="Mais opções"
                              className="flex h-[24px] w-[24px] items-center justify-center rounded-[4px] border border-[#2e2e2e] text-[14px] text-[#606060] hover:bg-[#252525] hover:text-[#e8e8e8]"
                            >
                              ⋯
                            </button>
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
        <CastMemberDrawer
          member={null}
          onClose={() => {
            setDrawerOpen(false);
          }}
          onSaved={onSaved}
        />
      ) : null}
    </PageShell>
  );
}
