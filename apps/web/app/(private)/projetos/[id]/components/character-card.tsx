"use client";

import { useMemo, useState, type MouseEvent } from "react";
import type {
  ProjectCharacterAssignmentDto,
  ProjectCharacterDto,
} from "@/app/types/project-character";
import type { CastMemberDto } from "@/app/types/cast-member";

const IMPORTANCE_LABEL: Record<string, string> = {
  MAIN: "Personagem principal",
  SUPPORT: "Personagem suporte",
  EXTRA: "Figurante",
};

const IMPORTANCE_STYLE: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  MAIN: {
    bg: "rgba(29,158,117,0.12)",
    border: "#1D9E75",
    text: "#5DCAA5",
  },
  SUPPORT: {
    bg: "#1a1a1a",
    border: "#303030",
    text: "#8c8c8c",
  },
  EXTRA: {
    bg: "#141414",
    border: "#252525",
    text: "#666666",
  },
};

const ASSIGNMENT_TYPE_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; border: string }
> = {
  PRINCIPAL: {
    label: "Principal",
    color: "#5DCAA5",
    bg: "#0d3d2a",
    border: "#0F6E56",
  },
  RESERVE: {
    label: "Reserva",
    color: "#A8B4CC",
    bg: "#242a35",
    border: "#384154",
  },
  TEST_OPTION_1: {
    label: "Teste 1",
    color: "#EF9F27",
    bg: "#3d3520",
    border: "#5c4a20",
  },
  TEST_OPTION_2: {
    label: "Teste 2",
    color: "#C4B0FC",
    bg: "#241b35",
    border: "#4b3775",
  },
  SUPPORT: {
    label: "Suporte",
    color: "#A0A0A0",
    bg: "#1d1d1d",
    border: "#333333",
  },
};

const ASSIGNMENT_STATUS_LABEL: Record<string, string> = {
  INVITED: "Convidado",
  TEST_SENT: "Teste enviado",
  TEST_RECEIVED: "Teste recebido",
  APPROVED: "Aprovado",
  CAST: "Escalado",
  REPLACED: "Substituído",
  DECLINED: "Recusou",
};

const ASSIGNMENT_STATUS_COLOR: Record<string, string> = {
  INVITED: "#909090",
  TEST_SENT: "#EF9F27",
  TEST_RECEIVED: "#7EC8E3",
  APPROVED: "#5DCAA5",
  CAST: "#5DCAA5",
  REPLACED: "#606060",
  DECLINED: "#F09595",
};

function avatarColor(name: string): { bg: string; color: string } {
  const colors = [
    { bg: "#0d3d2a", color: "#5DCAA5" },
    { bg: "#0d1f3d", color: "#93C5FD" },
    { bg: "#1e1a0d", color: "#FDE68A" },
    { bg: "#241b35", color: "#C4B5FD" },
    { bg: "#2a0a0a", color: "#F09595" },
  ];
  return colors[(name.charCodeAt(0) || 0) % colors.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((part) => part[0]!.toUpperCase()).join("");
}

function isInactiveAssignment(
  assignment: ProjectCharacterAssignmentDto,
): boolean {
  return assignment.status === "REPLACED" || assignment.status === "DECLINED";
}

function isActivePrincipal(assignment: ProjectCharacterAssignmentDto): boolean {
  return assignment.type === "PRINCIPAL" && !isInactiveAssignment(assignment);
}

type Props = {
  character: ProjectCharacterDto;
  castMembers: CastMemberDto[];
  projectId: string;
  onEdit: (character: ProjectCharacterDto) => void;
  onAssignmentChanged: () => void;
};

type AssignmentFormState = {
  castMemberId: string;
  type: string;
  status: string;
  notes: string;
};

const EMPTY_FORM: AssignmentFormState = {
  castMemberId: "",
  type: "PRINCIPAL",
  status: "INVITED",
  notes: "",
};

export function CharacterCard({
  character,
  castMembers,
  projectId,
  onEdit,
  onAssignmentChanged,
}: Props) {
  const importanceStyle =
    IMPORTANCE_STYLE[character.importance] ?? IMPORTANCE_STYLE.SUPPORT;

  const assignments = character.assignments ?? [];
  const hasAssignments = assignments.length > 0;

  const principalAssignment = useMemo(
    () => assignments.find(isActivePrincipal) ?? null,
    [assignments],
  );

  const effectivePrincipal = useMemo(() => {
    if (principalAssignment?.castMember) {
      return principalAssignment.castMember;
    }

    if (!hasAssignments && character.castMember) {
      return character.castMember;
    }

    return null;
  }, [principalAssignment, hasAssignments, character.castMember]);

  const visibleAssignments = useMemo(() => {
    const list = [...assignments];
    list.sort((a, b) => {
      const aPrincipal = isActivePrincipal(a) ? 0 : 1;
      const bPrincipal = isActivePrincipal(b) ? 0 : 1;
      if (aPrincipal !== bPrincipal) return aPrincipal - bPrincipal;
      if (a.priority !== b.priority) return a.priority - b.priority;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
    return list;
  }, [assignments]);

  const availableMembers = useMemo(
    () => castMembers.filter((member) => member.status !== "INACTIVE"),
    [castMembers],
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AssignmentFormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const compactButtonClass =
    "rounded-[4px] border border-[#2e2e2e] bg-transparent px-[7px] py-[2px] text-[10px] text-[#656565] transition-colors hover:bg-[#232323] hover:text-[#d2d2d2] disabled:opacity-40";

  const cardBorderColor = effectivePrincipal ? "#252525" : "#3d2e0d";

  const openNewForm = (event: MouseEvent) => {
    event.stopPropagation();
    setEditingId(null);
    setForm(EMPTY_FORM);
    setInlineError(null);
    setFormOpen(true);
  };

  const openEditForm = (
    event: MouseEvent,
    assignment: ProjectCharacterAssignmentDto,
  ) => {
    event.stopPropagation();
    setEditingId(assignment.id);
    setForm({
      castMemberId: assignment.castMemberId,
      type: assignment.type,
      status: assignment.status,
      notes: assignment.notes ?? "",
    });
    setInlineError(null);
    setFormOpen(true);
  };

  const closeForm = (event?: MouseEvent) => {
    event?.stopPropagation();
    setFormOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setInlineError(null);
  };

  const handleSave = async (event: MouseEvent) => {
    event.stopPropagation();

    if (!editingId && !form.castMemberId) {
      setInlineError("Selecione um dublador.");
      return;
    }

    setSaving(true);
    setInlineError(null);

    try {
      const isEdit = Boolean(editingId);
      const url = isEdit
        ? `/api/dubbing-projects/${projectId}/character-assignments/${editingId}`
        : `/api/dubbing-projects/${projectId}/character-assignments`;

      const body = isEdit
        ? {
            type: form.type,
            status: form.status,
            notes: form.notes || null,
          }
        : {
            characterId: character.id,
            castMemberId: form.castMemberId,
            type: form.type,
            status: form.status,
            notes: form.notes || null,
          };

      const response = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const raw = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setInlineError(raw.error ?? "Erro ao salvar assignment.");
        return;
      }

      closeForm();
      onAssignmentChanged();
    } catch {
      setInlineError("Falha de rede ao salvar assignment.");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (event: MouseEvent, assignmentId: string) => {
    event.stopPropagation();

    const confirmed = window.confirm("Remover assignment?");
    if (!confirmed) return;

    setRemovingId(assignmentId);
    setInlineError(null);

    try {
      const response = await fetch(
        `/api/dubbing-projects/${projectId}/character-assignments/${assignmentId}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        const raw = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        setInlineError(raw.error ?? "Erro ao remover assignment.");
        return;
      }

      onAssignmentChanged();
    } catch {
      setInlineError("Falha de rede ao remover assignment.");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div
      className="flex flex-col rounded-[10px] border bg-[#1a1a1a]"
      style={{ borderColor: cardBorderColor }}
    >
      <button
        type="button"
        onClick={() => onEdit(character)}
        className="flex w-full flex-col gap-[10px] p-[14px] text-left"
      >
        <div className="flex items-start justify-between gap-[8px]">
          <div className="min-w-0">
            <div className="truncate text-[14px] font-[600] text-[#f1f1f1]">
              {character.name}
            </div>
            <div className="mt-[2px] text-[10px] text-[#717171]">
              {[character.type, character.voiceType]
                .filter(Boolean)
                .join(" · ") || "Sem tipo definido"}
            </div>
          </div>

          <span
            className="flex-shrink-0 rounded-[999px] px-[8px] py-[2px] text-[10px] font-[500]"
            style={{
              background: importanceStyle.bg,
              border: `0.5px solid ${importanceStyle.border}`,
              color: importanceStyle.text,
            }}
          >
            {IMPORTANCE_LABEL[character.importance]}
          </span>
        </div>

        <div className="h-px bg-[#252525]" />

        {effectivePrincipal ? (
          <div className="flex items-center gap-[8px]">
            <div
              className="flex h-[24px] w-[24px] flex-shrink-0 items-center justify-center rounded-full text-[9px] font-[700]"
              style={avatarColor(effectivePrincipal.name)}
            >
              {getInitials(effectivePrincipal.name)}
            </div>

            <div className="min-w-0">
              <div className="text-[9px] uppercase tracking-[0.06em] text-[#666666]">
                Dublador principal
              </div>
              <div className="truncate text-[11px] text-[#e8e8e8]">
                {effectivePrincipal.name}
              </div>
            </div>
          </div>
        ) : (
          <div
            className="flex items-center gap-[6px] text-[11px]"
            style={{ color: "#EF9F27" }}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>Nenhum dublador principal definido</span>
          </div>
        )}
      </button>

      <div
        className="flex items-center justify-between gap-[8px] border-t border-[#252525] px-[14px] py-[8px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex min-w-0 flex-wrap gap-[4px]">
          {visibleAssignments.slice(0, 4).map((assignment) => {
            const config = ASSIGNMENT_TYPE_CONFIG[assignment.type];
            if (!config) return null;

            return (
              <span
                key={assignment.id}
                className="rounded-[4px] px-[6px] py-[2px] text-[9px] font-[500]"
                style={{
                  background: config.bg,
                  border: `0.5px solid ${config.border}`,
                  color: config.color,
                }}
                title={`${config.label}: ${assignment.castMember?.name ?? "—"} · ${
                  ASSIGNMENT_STATUS_LABEL[assignment.status] ??
                  assignment.status
                }`}
              >
                {config.label}
              </span>
            );
          })}

          {visibleAssignments.length > 4 ? (
            <span className="rounded-[4px] border border-[#2e2e2e] bg-[#141414] px-[6px] py-[2px] text-[9px] text-[#666666]">
              +{visibleAssignments.length - 4}
            </span>
          ) : null}
        </div>
      </div>

      <div
        className="border-t border-[#1f1f1f] bg-[#141414] px-[14px] py-[12px]"
        onClick={(event) => event.stopPropagation()}
      >
        {inlineError ? (
          <p className="mb-[8px] text-[10px] text-[#F09595]">{inlineError}</p>
        ) : null}

        {visibleAssignments.length === 0 && !formOpen ? (
          <p className="mb-[10px] text-[11px] text-[#4f4f4f]">
            Nenhum assignment ainda.
          </p>
        ) : null}

        {visibleAssignments.length > 0 ? (
          <ul className="mb-[10px] flex flex-col gap-[5px]">
            {visibleAssignments.map((assignment) => {
              const config =
                ASSIGNMENT_TYPE_CONFIG[assignment.type] ??
                ({
                  label: assignment.type,
                  color: "#909090",
                  bg: "#1d1d1d",
                  border: "#333333",
                } as const);

              const memberName =
                assignment.castMember?.name ??
                castMembers.find(
                  (member) => member.id === assignment.castMemberId,
                )?.name ??
                assignment.castMemberId;

              const isRemoving = removingId === assignment.id;
              const isEditingThis = editingId === assignment.id && formOpen;
              const activePrincipal = isActivePrincipal(assignment);

              return (
                <li
                  key={assignment.id}
                  className="flex items-center justify-between gap-[8px] rounded-[6px] border bg-[#191919] px-[8px] py-[6px]"
                  style={
                    activePrincipal
                      ? {
                          borderColor: "#0F6E56",
                          boxShadow: "inset 0 0 0 1px #0F6E56",
                        }
                      : isEditingThis
                        ? { borderColor: "#1D9E75" }
                        : { borderColor: "#252525" }
                  }
                >
                  <div className="flex min-w-0 items-center gap-[7px]">
                    <div
                      className="flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full text-[8px] font-[700]"
                      style={avatarColor(memberName)}
                    >
                      {getInitials(memberName)}
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-[11px] text-[#d8d8d8]">
                        {memberName}
                      </div>

                      <div className="mt-[1px] flex flex-wrap items-center gap-[4px]">
                        <span
                          className="rounded-[4px] px-[5px] py-[1px] text-[9px] font-[600]"
                          style={{
                            background: config.bg,
                            border: `0.5px solid ${config.border}`,
                            color: config.color,
                          }}
                        >
                          {activePrincipal ? `${config.label}` : config.label}
                        </span>

                        <span
                          className="text-[9px]"
                          style={{
                            color:
                              ASSIGNMENT_STATUS_COLOR[assignment.status] ??
                              "#606060",
                          }}
                        >
                          {ASSIGNMENT_STATUS_LABEL[assignment.status] ??
                            assignment.status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 items-center gap-[4px]">
                    <button
                      type="button"
                      disabled={isRemoving || saving}
                      onClick={(event) => openEditForm(event, assignment)}
                      className={compactButtonClass}
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      disabled={isRemoving || saving}
                      onClick={(event) =>
                        void handleRemove(event, assignment.id)
                      }
                      className={`${compactButtonClass} hover:border-[#5a1515] hover:bg-[#2a0a0a] hover:text-[#F09595]`}
                    >
                      {isRemoving ? "…" : "✕"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        {formOpen ? (
          <div className="mb-[10px] flex flex-col gap-[8px] rounded-[8px] border border-[#1D9E75] bg-[#0d1a14] p-[10px]">
            <div className="text-[10px] font-[600] uppercase tracking-[0.06em] text-[#1D9E75]">
              {editingId ? "Editar assignment" : "Novo assignment"}
            </div>

            {!editingId ? (
              <div>
                <label className="mb-[4px] block text-[9px] font-[600] uppercase tracking-[0.06em] text-[#5e5e5e]">
                  Dublador *
                </label>

                <select
                  value={form.castMemberId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      castMemberId: event.target.value,
                    }))
                  }
                  onClick={(event) => event.stopPropagation()}
                  className="w-full rounded-[5px] border border-[#2e2e2e] bg-[#111111] px-[8px] py-[6px] text-[11px] text-[#e8e8e8] outline-none focus:border-[#1D9E75]"
                >
                  <option value="">— Selecionar —</option>
                  {availableMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name}
                      {member.role ? ` · ${member.role}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            <div>
              <label className="mb-[4px] block text-[9px] font-[600] uppercase tracking-[0.06em] text-[#5e5e5e]">
                Tipo
              </label>

              <div className="flex flex-wrap gap-[4px]">
                {Object.entries(ASSIGNMENT_TYPE_CONFIG).map(([key, config]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setForm((current) => ({ ...current, type: key }));
                    }}
                    className="rounded-[999px] border px-[8px] py-[3px] text-[10px] font-[500] transition-colors"
                    style={
                      form.type === key
                        ? {
                            background: config.bg,
                            borderColor: config.border,
                            color: config.color,
                          }
                        : {
                            background: "transparent",
                            borderColor: "#2e2e2e",
                            color: "#606060",
                          }
                    }
                  >
                    {config.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-[4px] block text-[9px] font-[600] uppercase tracking-[0.06em] text-[#5e5e5e]">
                Status
              </label>

              <select
                value={form.status}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    status: event.target.value,
                  }))
                }
                onClick={(event) => event.stopPropagation()}
                className="w-full rounded-[5px] border border-[#2e2e2e] bg-[#111111] px-[8px] py-[6px] text-[11px] text-[#e8e8e8] outline-none focus:border-[#1D9E75]"
              >
                {Object.entries(ASSIGNMENT_STATUS_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-[4px] block text-[9px] font-[600] uppercase tracking-[0.06em] text-[#5e5e5e]">
                Notas (opcional)
              </label>

              <input
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                onClick={(event) => event.stopPropagation()}
                placeholder="Observações sobre este assignment"
                className="w-full rounded-[5px] border border-[#2e2e2e] bg-[#111111] px-[8px] py-[6px] text-[11px] text-[#e8e8e8] outline-none focus:border-[#1D9E75] placeholder:text-[#444444]"
              />
            </div>

            <div className="flex items-center gap-[6px] pt-[2px]">
              <button
                type="button"
                onClick={(event) => closeForm(event)}
                className="rounded-[5px] border border-[#2e2e2e] px-[8px] py-[4px] text-[10px] text-[#686868] transition-colors hover:bg-[#252525]"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={(event) => void handleSave(event)}
                className="rounded-[5px] border border-[#0F6E56] bg-[#1D9E75] px-[10px] py-[4px] text-[10px] font-[600] text-white transition-colors hover:bg-[#0F6E56] disabled:opacity-40"
              >
                {saving ? "Salvando…" : editingId ? "Salvar" : "Adicionar"}
              </button>
            </div>
          </div>
        ) : null}

        {!formOpen ? (
          <button
            type="button"
            onClick={openNewForm}
            className="flex w-full items-center justify-center gap-[5px] rounded-[5px] border border-dashed border-[#2e2e2e] py-[6px] text-[10px] text-[#616161] transition-colors hover:border-[#1D9E75] hover:text-[#5DCAA5]"
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
              <path
                d="M8 2v12M2 8h12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Adicionar dublador
          </button>
        ) : null}
      </div>
    </div>
  );
}
