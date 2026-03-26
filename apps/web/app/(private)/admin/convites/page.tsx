"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConfirm } from "@/app/components/confirm-provider";
import { PageShell } from "@/app/components/page-shell";
import { usePrivateAuth } from "@/app/components/private-auth-provider";
import { ListSearchField } from "@/app/components/list-search-field";
import { StatusPill } from "@/app/components/status-pill";
import { KpiCard } from "@/app/(private)/projetos/components/kpi-card";
import { InviteNewModal } from "./components/invite-new-modal";
import {
  TableRowActionsMenu,
  TableRowMenuDangerItem,
  TableRowMenuItem,
} from "@/app/components/table-row-actions-menu";
import "../../projetos/projetos.css";
import "./convites.css";

type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

type EmailDeliveryStatus = "pending" | "processing" | "sent" | "failed";

type InviteRow = {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
  invitedByUserId: string;
  status: InviteStatus;
  emailDelivery?: {
    status: EmailDeliveryStatus;
    sentAt: string | null;
    /** Data de criação do registo de envio (fila); usada quando `sentAt` ainda é null. */
    createdAt?: string;
    lastError: string | null;
  } | null;
};

const STATUS_LABEL: Record<InviteStatus, string> = {
  pending: "Pendente",
  accepted: "Aceito",
  revoked: "Revogado",
  expired: "Expirado",
};

/** Mesmo padrão visual que `StatusBadge` em `projects-table.tsx` (pílula + dot). */
const INVITE_STATUS_PILL: Record<
  InviteStatus,
  { dot: string; border: string; bg: string; text: string }
> = {
  pending: {
    dot: "#FBBF24",
    border: "#FBBF24",
    bg: "rgba(251,191,36,0.12)",
    text: "#FCD34D",
  },
  accepted: {
    dot: "#4ade80",
    border: "#4ade80",
    bg: "rgba(74,222,128,0.12)",
    text: "#86EFAC",
  },
  expired: {
    dot: "#f87171",
    border: "#f87171",
    bg: "rgba(248,113,113,0.14)",
    text: "#fca5a5",
  },
  revoked: {
    dot: "#606060",
    border: "#606060",
    bg: "rgba(96,96,96,0.15)",
    text: "#909090",
  },
};

function errorMessageFromBody(data: unknown): string {
  if (data && typeof data === "object" && "error" in data) {
    const e = (data as { error?: unknown }).error;
    if (typeof e === "string" && e.trim()) return e;
  }
  return "Pedido falhou";
}

/** Data curta (dd/mm/aaaa) ou relativo nos últimos 7 dias. */
function formatDateOrRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = Date.now();
  const diffMs = now - d.getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days >= 0 && days <= 7) {
    if (days === 0) return "hoje";
    if (days === 1) return "há 1 dia";
    return `há ${days} dias`;
  }
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatExpiresAt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Preferência: data de envio efectivo; senão enfileiramento; senão criação do convite. */
function formatEnviadoEm(inv: InviteRow): { text: string; title: string } {
  const e = inv.emailDelivery;
  if (e?.sentAt) {
    return {
      text: formatDateOrRelative(e.sentAt),
      title: "Data em que o email foi enviado (worker/Resend)",
    };
  }
  if (e?.createdAt) {
    return {
      text: formatDateOrRelative(e.createdAt),
      title:
        "Email ainda não enviado. Data de enfileiramento na fila de envio.",
    };
  }
  return {
    text: formatDateOrRelative(inv.createdAt),
    title: "Sem registo de envio; data de criação do convite",
  };
}

function InviteStatusBadge({ status }: { status: InviteStatus }) {
  const b = INVITE_STATUS_PILL[status] ?? INVITE_STATUS_PILL.expired;
  return (
    <StatusPill
      label={STATUS_LABEL[status] ?? status}
      dot={b.dot}
      border={b.border}
      bg={b.bg}
      text={b.text}
    />
  );
}

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

export default function AdminConvitesPage() {
  const confirm = useConfirm();
  const { user } = usePrivateAuth();
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [hasFetchedOnce, setHasFetchedOnce] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialEmail, setModalInitialEmail] = useState<
    string | undefined
  >(undefined);
  const [q, setQ] = useState("");

  const loadInvites = useCallback(async () => {
    setListLoading(true);
    setListError(null);
    try {
      const res = await fetch("/api/admin/invites", {
        credentials: "include",
        cache: "no-store",
      });
      if (res.status === 403 || res.status === 401) {
        setListError("Sem permissão para ver convites.");
        setInvites([]);
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as unknown;
        setListError(errorMessageFromBody(data));
        setInvites([]);
        return;
      }
      const data = (await res.json()) as { invites?: InviteRow[] };
      setInvites(Array.isArray(data.invites) ? data.invites : []);
    } catch {
      setListError("Não foi possível carregar a lista.");
      setInvites([]);
    } finally {
      setListLoading(false);
      setHasFetchedOnce(true);
    }
  }, []);

  useEffect(() => {
    if (user.role === "ADMIN") {
      void loadInvites();
    } else {
      setListLoading(false);
    }
  }, [user.role, loadInvites]);

  const needle = q.trim().toLowerCase();
  const filteredInvites = useMemo(() => {
    if (!needle) return invites;
    return invites.filter((inv) =>
      inv.email.toLowerCase().includes(needle),
    );
  }, [invites, needle]);

  const inviteMetrics = useMemo(() => {
    let pending = 0;
    let accepted = 0;
    let revoked = 0;
    for (const inv of invites) {
      if (inv.status === "pending") pending += 1;
      else if (inv.status === "accepted") accepted += 1;
      else if (inv.status === "revoked") revoked += 1;
    }
    return {
      total: invites.length,
      pending,
      accepted,
      revoked,
    };
  }, [invites]);

  const onRevoke = useCallback(
    async (id: string) => {
      const inv = invites.find((i) => i.id === id);
      const ok = await confirm({
        title: "Revogar convite",
        description: inv
          ? `Confirma revogar o convite enviado para ${inv.email}? O destinatário deixará de poder aceitar.`
          : "Confirma revogar este convite?",
        variant: "danger",
        confirmLabel: "Sim, revogar",
      });
      if (!ok) return;
      setRevokingId(id);
      try {
        const res = await fetch(
          `/api/admin/invites/${encodeURIComponent(id)}/revoke`,
          {
            method: "POST",
            credentials: "include",
            headers: { "content-type": "application/json" },
            body: "{}",
          },
        );
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as unknown;
          setListError(errorMessageFromBody(data));
          return;
        }
        await loadInvites();
      } catch {
        setListError("Não foi possível revogar.");
      } finally {
        setRevokingId(null);
      }
    },
    [confirm, invites, loadInvites],
  );

  function openNewInvite() {
    setModalInitialEmail(undefined);
    setModalOpen(true);
  }

  function openReenviar(email: string) {
    setModalInitialEmail(email);
    setModalOpen(true);
  }

  if (user.role !== "ADMIN") {
    return (
      <PageShell title="Convites" section="gestao" subtitle="Apenas administradores">
        <div className="px-6 py-8">
          <p className="text-sm text-[var(--text-muted)]">Acesso negado.</p>
        </div>
      </PageShell>
    );
  }

  const showInitialSkeleton = listLoading && !hasFetchedOnce;

  return (
    <PageShell
      title="Convites"
      subtitle={`· ${inviteMetrics.total}`}
      section="gestao"
    >
      <div className="min-h-0 flex-1 overflow-y-auto px-[24px] py-[24px]">
        <div className="projects-container">
          <div className="flex items-center gap-[8px]">
            <ListSearchField
              value={q}
              onChange={setQ}
              placeholder="Buscar por email..."
              ariaLabel="Buscar convites por email"
            />
            <div className="flex-1" />
            <button
              type="button"
              onClick={openNewInvite}
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
              Novo convite
            </button>
          </div>

          {!showInitialSkeleton && hasFetchedOnce && !(listError && invites.length === 0) ? (
            <div className="projects-kpi-grid">
              <KpiCard
                label="Total de convites"
                value={inviteMetrics.total}
                sub="registos"
              />
              <KpiCard
                label="Pendentes"
                value={inviteMetrics.pending}
                sub="aguardando aceite"
              />
              <KpiCard
                label="Aceitos"
                value={inviteMetrics.accepted}
                sub="contas criadas"
              />
              <KpiCard
                label="Revogados"
                value={inviteMetrics.revoked}
                sub="cancelados"
              />
            </div>
          ) : null}

          <div className="projects-table-card convites-table-wrap">
            {showInitialSkeleton ? (
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <TableSkeleton rows={6} />
              </div>
            ) : listError && invites.length === 0 ? (
              <div className="px-4 py-16 text-center">
                <p className="text-sm text-[#f87171]" role="alert">
                  {listError}
                </p>
              </div>
            ) : invites.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
                <p className="text-[13px] text-[#909090]">
                  Nenhum convite ainda.
                </p>
                <button
                  type="button"
                  onClick={openNewInvite}
                  className="rounded-[6px] border border-[#0F6E56] bg-[#1D9E75] px-[16px] py-[8px] text-[12px] font-[500] text-white transition-colors hover:bg-[#0F6E56]"
                >
                  Novo convite
                </button>
              </div>
            ) : (
              <>
                {listError ? (
                  <div className="border-b border-[#252525] px-[18px] py-3">
                    <p className="text-sm text-[#f87171]" role="alert">
                      {listError}
                    </p>
                  </div>
                ) : null}
                <div
                  className={`min-h-0 flex-1 overflow-x-auto overflow-y-auto transition-opacity duration-150 ${
                    listLoading ? "opacity-60" : ""
                  }`}
                  aria-busy={listLoading}
                >
                  <table className="projects-table">
                    <colgroup>
                      <col className="col-email" />
                      <col className="col-status" />
                      <col className="col-enviado" />
                      <col className="col-expira" />
                      <col className="col-acoes" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th className="th-center">Status</th>
                        <th>Enviado em</th>
                        <th>Expira em</th>
                        <th className="th-actions th-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInvites.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-10 text-center text-[13px] text-[#707070]"
                          >
                            Nenhum convite corresponde à busca.
                          </td>
                        </tr>
                      ) : (
                        filteredInvites.map((inv) => {
                          const enviado = formatEnviadoEm(inv);
                          const expira = formatExpiresAt(inv.expiresAt);
                          return (
                            <tr key={inv.id}>
                              <td>
                                <div className="proj-cell-name font-bold">
                                  {inv.email}
                                </div>
                              </td>
                              <td className="td-status td-center">
                                <InviteStatusBadge status={inv.status} />
                              </td>
                              <td
                                style={{ color: "#909090" }}
                                title={enviado.title}
                              >
                                {enviado.text}
                              </td>
                              <td style={{ color: "#909090" }} title="Data limite do convite">
                                {expira}
                              </td>
                              <td
                                className="td-right"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="row-actions flex justify-end">
                                  {inv.status === "pending" ? (
                                    <TableRowActionsMenu
                                      ariaLabel={`Ações do convite ${inv.email}`}
                                    >
                                      <TableRowMenuItem
                                        onSelect={() =>
                                          openReenviar(inv.email)
                                        }
                                      >
                                        Reenviar convite
                                      </TableRowMenuItem>
                                      <TableRowMenuDangerItem
                                        disabled={revokingId === inv.id}
                                        onSelect={() =>
                                          void onRevoke(inv.id)
                                        }
                                      >
                                        {revokingId === inv.id
                                          ? "A revogar…"
                                          : "Revogar convite"}
                                      </TableRowMenuDangerItem>
                                    </TableRowActionsMenu>
                                  ) : (
                                    <span className="text-[11px] text-[#505050]">
                                      —
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <InviteNewModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        initialEmail={modalInitialEmail}
        onSuccess={() => void loadInvites()}
      />
    </PageShell>
  );
}
