"use client";

import {
  CommunicationChannelChip,
  CommunicationChannelChipRow,
} from "@/app/components/communication-channel-chip";
import { useConfirm } from "@/app/components/confirm-provider";
import type { CastMemberDto } from "@/app/types/cast-member";
import type {
  CommunicationChannel,
  CommunicationDirection,
  CommunicationGroupConsolidatedStatus,
  CommunicationGroupListItemDto,
  CommunicationLogDto,
  CommunicationStatus,
} from "@/app/types/communication-log";
import type { RecordingSessionDto } from "@/app/types/recording-session";
import {
  resolveSessionDualOutboundChannelsForUi,
  type CommunicationFormPrefill,
} from "@/app/lib/communication-session-prefill";
import {
  buildSessionCommunicationTemplate,
  COMMUNICATION_TEMPLATE_LABELS,
  COMMUNICATION_TEMPLATE_TYPES,
  inferTemplateTypeFromKey,
  type CommunicationTemplateType,
} from "@/app/lib/communication-templates";
import { useCallback, useEffect, useState } from "react";

export type CommunicationTabDraft = {
  /** Incrementado no pai para cada novo pedido de pré-preenchimento */
  seed: number;
  prefill: CommunicationFormPrefill;
};

const inputCls =
  "w-full min-h-[36px] rounded-[6px] border border-[#2e2e2e] bg-[#111] px-[10px] py-[7px] text-[13px] text-[#e8e8e8] outline-none placeholder:text-[#505050] focus:border-[#1D9E75] transition-colors";
const lockedFieldCls = `${inputCls} cursor-not-allowed bg-[#0c0c0c] opacity-90`;
const labelCls =
  "mb-[5px] block text-[10px] font-[600] uppercase tracking-[0.07em] text-[#505050]";

const CHANNELS: { value: CommunicationChannel; label: string }[] = [
  { value: "EMAIL", label: "E-mail" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "SYSTEM", label: "Sistema" },
];

const DIRECTIONS: { value: CommunicationDirection; label: string }[] = [
  { value: "OUTBOUND", label: "Saída" },
  { value: "INBOUND", label: "Entrada" },
];

function consolidatedStatusLabel(
  s: CommunicationGroupConsolidatedStatus,
): string {
  switch (s) {
    case "PENDENTE":
      return "Pendente";
    case "PROCESSANDO":
      return "A processar";
    case "ENVIADO_PARCIALMENTE":
      return "Enviado parcialmente";
    case "ENVIADO":
      return "Enviado";
    case "FALHA_PARCIAL":
      return "Falha parcial";
    case "FALHA":
      return "Falhou";
    default:
      return s;
  }
}

function consolidatedStatusChipClass(
  s: CommunicationGroupConsolidatedStatus,
): string {
  switch (s) {
    case "ENVIADO":
      return "border-[#1d7043] bg-[#173626] text-[#72d89a]";
    case "FALHA":
    case "FALHA_PARCIAL":
      return "border-[#7a3131] bg-[#3a1515] text-[#f0a0a0]";
    case "PROCESSANDO":
      return "border-[#6b5a1d] bg-[#2a2810] text-[#d4c96a]";
    case "ENVIADO_PARCIALMENTE":
      return "border-[#315d7a] bg-[#1a3144] text-[#a7d8f0]";
    default:
      return "border-[#3b3b3b] bg-[#262626] text-[#b0b0b0]";
  }
}

type FormState = {
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  status: CommunicationStatus;
  subject: string;
  body: string;
  templateKey: string;
  recipientName: string;
  recipientEmail: string;
  recipientWhatsapp: string;
  sessionId: string;
  castMemberId: string;
  error: string;
};

const emptyForm = (): FormState => ({
  channel: "EMAIL",
  direction: "OUTBOUND",
  status: "PENDING",
  subject: "",
  body: "",
  templateKey: "",
  recipientName: "",
  recipientEmail: "",
  recipientWhatsapp: "",
  sessionId: "",
  castMemberId: "",
  error: "",
});

function groupToForm(group: CommunicationGroupListItemDto): FormState {
  const head = group.logs[0]!;
  const emailLog = group.logs.find((l) => l.channel === "EMAIL");
  const waLog = group.logs.find((l) => l.channel === "WHATSAPP");
  return {
    channel: head.channel,
    direction: head.direction,
    status: head.status,
    subject: group.subject ?? "",
    body: group.body,
    templateKey: head.templateKey ?? "",
    recipientName: group.recipientName ?? "",
    recipientEmail: emailLog?.recipientEmail ?? group.recipientEmail ?? "",
    recipientWhatsapp:
      waLog?.recipientWhatsapp ?? group.recipientWhatsapp ?? "",
    sessionId: head.sessionId ?? "",
    castMemberId: head.castMemberId ?? "",
    error: head.error ?? "",
  };
}

type FormMode = "new_manual" | "new_from_session" | "edit";

/** Envio real (PR 25): EMAIL/WHATSAPP outbound com destinatário e corpo preenchidos. */
function canOfferRealSend(log: CommunicationLogDto): boolean {
  if (
    (log.channel !== "EMAIL" && log.channel !== "WHATSAPP") ||
    log.direction !== "OUTBOUND"
  ) {
    return false;
  }
  if (
    log.status === "SENT" ||
    log.status === "RECEIVED" ||
    log.status === "PROCESSING"
  ) {
    return false;
  }
  if (log.channel === "EMAIL") {
    return Boolean(log.recipientEmail?.trim()) && Boolean(log.body?.trim());
  }
  return Boolean(log.recipientWhatsapp?.trim()) && Boolean(log.body?.trim());
}

function canOfferRealSendGroup(group: CommunicationGroupListItemDto): boolean {
  return group.logs.some((log) => canOfferRealSend(log));
}

export function ProjectCommunicationTab(props: {
  projectId: string;
  projectName: string;
  castMembers: CastMemberDto[];
  sessions: RecordingSessionDto[];
  /** Rascunho vindo da agenda (pré-preenchido a partir de uma sessão). */
  communicationDraft?: CommunicationTabDraft | null;
  onCommunicationDraftConsumed?: () => void;
}) {
  const {
    projectId,
    projectName,
    castMembers,
    sessions,
    communicationDraft = null,
    onCommunicationDraftConsumed,
  } = props;
  const confirm = useConfirm();

  const [communicationGroups, setCommunicationGroups] = useState<
    CommunicationGroupListItemDto[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<
    "success" | "error" | "info"
  >("success");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formMode, setFormMode] = useState<FormMode>("new_manual");
  const [selectedTemplateType, setSelectedTemplateType] =
    useState<CommunicationTemplateType>("SESSION_REMINDER");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [deletingGroupId, setDeletingGroupId] = useState<string | null>(null);
  const [sendingGroupId, setSendingGroupId] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/dubbing-projects/${encodeURIComponent(projectId)}/communication-logs`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        setCommunicationGroups([]);
        setFeedbackTone("error");
        setFeedback("Não foi possível carregar o histórico de comunicação.");
        return;
      }
      const data = (await res.json()) as {
        communicationGroups?: CommunicationGroupListItemDto[];
      };
      setCommunicationGroups(data.communicationGroups ?? []);
    } catch {
      setCommunicationGroups([]);
      setFeedbackTone("error");
      setFeedback("Falha de rede ao carregar comunicação.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const requestGroupSend = async (
    group: CommunicationGroupListItemDto,
    options?: { silent?: boolean },
  ): Promise<boolean> => {
    const silent = options?.silent === true;
    if (!silent) setSendingGroupId(group.groupId);
    try {
      const res = await fetch(
        `/api/dubbing-projects/${encodeURIComponent(projectId)}/communication-groups/${encodeURIComponent(group.groupId)}/send`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        queued?: boolean;
        acceptedCount?: number;
      };
      if (!res.ok) {
        if (!silent) {
          setFeedbackTone("error");
          setFeedback(
            data.error ?? "Não foi possível pedir o envio da comunicação.",
          );
        }
        return false;
      }
      if (!silent) {
        setFeedbackTone("success");
        setFeedback(
          data.acceptedCount != null && data.acceptedCount > 1
            ? `Pedido de envio aceite para ${data.acceptedCount} canais. O worker processará em breve.`
            : "Pedido de envio aceite. O worker processará em breve (ver estado na lista).",
        );
      }
      return true;
    } catch {
      if (!silent) {
        setFeedbackTone("error");
        setFeedback("Falha de rede ao enviar.");
      }
      return false;
    } finally {
      if (!silent) {
        await loadLogs();
        setSendingGroupId(null);
      }
    }
  };

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    if (!communicationDraft) return;
    const draftTemplateType = inferTemplateTypeFromKey(
      communicationDraft.prefill.templateKey,
    );
    setForm({
      ...emptyForm(),
      ...communicationDraft.prefill,
    });
    setSelectedTemplateType(draftTemplateType);
    setEditingGroupId(null);
    setFormMode("new_from_session");
    setFeedback(null);
    onCommunicationDraftConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- notificar o pai após aplicar; callback estável via useCallback na página
  }, [communicationDraft]);

  const clearManualForm = () => {
    setForm(emptyForm());
    setSelectedTemplateType("SESSION_REMINDER");
    setFormMode("new_manual");
    setFeedback(null);
  };

  const isSessionLockedFlow =
    formMode === "new_from_session" && !editingGroupId;

  const buildCreateBody = () => {
    if (isSessionLockedFlow) {
      return {
        sessionDualOutbound: true,
        channel: form.channel,
        direction: "OUTBOUND" as const,
        status: "PENDING" as const,
        subject: form.subject.trim() || undefined,
        body: form.body.trim(),
        templateKey: form.templateKey.trim() || undefined,
        sessionId: form.sessionId.trim() || null,
        castMemberId: form.castMemberId.trim() || null,
      };
    }
    return {
      channel: form.channel,
      direction: form.direction,
      status: "PENDING" as const,
      subject: form.subject.trim() || undefined,
      body: form.body.trim(),
      templateKey: form.templateKey.trim() || undefined,
      recipientName: form.recipientName.trim() || undefined,
      recipientEmail: form.recipientEmail.trim() || undefined,
      recipientWhatsapp: form.recipientWhatsapp.trim() || undefined,
      sessionId: form.sessionId.trim() || null,
      castMemberId: form.castMemberId.trim() || null,
    };
  };

  const buildPatchBody = () => ({
    channel: form.channel,
    direction: form.direction,
    subject: form.subject.trim() ? form.subject.trim() : null,
    body: form.body.trim(),
    templateKey: form.templateKey.trim() ? form.templateKey.trim() : null,
    recipientName: form.recipientName.trim() ? form.recipientName.trim() : null,
    recipientEmail: form.recipientEmail.trim()
      ? form.recipientEmail.trim()
      : null,
    recipientWhatsapp: form.recipientWhatsapp.trim()
      ? form.recipientWhatsapp.trim()
      : null,
    sessionId: form.sessionId.trim() || null,
    castMemberId: form.castMemberId.trim() || null,
  });

  const saveCommunicationLog = async () => {
    if (!form.body.trim()) {
      setFeedbackTone("error");
      setFeedback("O campo mensagem (corpo) é obrigatório.");
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      if (editingGroupId) {
        const res = await fetch(
          `/api/dubbing-projects/${encodeURIComponent(projectId)}/communication-groups/${encodeURIComponent(editingGroupId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildPatchBody()),
          },
        );
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as {
            error?: string;
          };
          setFeedbackTone("error");
          setFeedback(err.error ?? "Não foi possível atualizar o registo.");
          return;
        }
        setFeedbackTone("success");
        setFeedback("Comunicação atualizada.");
        setEditingGroupId(null);
        setForm(emptyForm());
        setFormMode("new_manual");
      } else {
        const res = await fetch(
          `/api/dubbing-projects/${encodeURIComponent(projectId)}/communication-logs`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildCreateBody()),
          },
        );
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as {
            error?: string;
            details?: Record<string, string[] | undefined>;
          };
          setFeedbackTone("error");
          const detailMsg =
            err.details && typeof err.details === "object"
              ? Object.values(err.details).flat().filter(Boolean).join(" ")
              : "";
          setFeedback(
            err.error ?? (detailMsg || "Não foi possível criar o registo."),
          );
          return;
        }
        const created = (await res.json().catch(() => ({}))) as {
          log?: CommunicationLogDto;
          logs?: CommunicationLogDto[];
        };
        setFeedbackTone("success");
        if (Array.isArray(created.logs) && created.logs.length > 1) {
          setFeedback("Comunicação criada");
        } else {
          setFeedback("Registo criado.");
        }
        setForm(emptyForm());
        setFormMode("new_manual");
      }
      await loadLogs();
    } catch {
      setFeedbackTone("error");
      setFeedback("Falha de rede ao guardar.");
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (group: CommunicationGroupListItemDto) => {
    setEditingGroupId(group.groupId);
    setForm(groupToForm(group));
    setSelectedTemplateType(
      inferTemplateTypeFromKey(group.logs[0]?.templateKey),
    );
    setFormMode("edit");
    setFeedback(null);
  };

  const onCancelEdit = () => {
    setEditingGroupId(null);
    setForm(emptyForm());
    setSelectedTemplateType("SESSION_REMINDER");
    setFormMode("new_manual");
    setFeedback(null);
  };

  const onDelete = async (group: CommunicationGroupListItemDto) => {
    const ok = await confirm({
      title: "Remover comunicação?",
      description:
        group.logs.length > 1
          ? "Todos os canais desta comunicação serão removidos. Esta ação não pode ser desfeita."
          : "Esta ação não pode ser desfeita.",
      confirmLabel: "Remover",
      cancelLabel: "Cancelar",
      variant: "danger",
    });
    if (!ok) return;
    setDeletingGroupId(group.groupId);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/dubbing-projects/${encodeURIComponent(projectId)}/communication-groups/${encodeURIComponent(group.groupId)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        setFeedbackTone("error");
        setFeedback("Não foi possível remover o registo.");
        return;
      }
      if (editingGroupId === group.groupId) onCancelEdit();
      setFeedbackTone("success");
      setFeedback("Comunicação removida.");
      await loadLogs();
    } catch {
      setFeedbackTone("error");
      setFeedback("Falha de rede ao remover.");
    } finally {
      setDeletingGroupId(null);
    }
  };

  const applySelectedTemplate = async () => {
    const session = sessions.find((s) => s.id === form.sessionId);
    if (!session) {
      setFeedbackTone("error");
      setFeedback(
        "Selecione uma sessão para aplicar template de comunicação. O template básico depende do contexto da sessão.",
      );
      return;
    }

    const castDisplayName =
      form.recipientName.trim() ||
      castMembers.find((m) => m.id === form.castMemberId)?.name?.trim() ||
      session.castMember?.name?.trim() ||
      "Dublador";

    const nextTemplate = buildSessionCommunicationTemplate({
      templateType: selectedTemplateType,
      session,
      projectName: projectName.trim() || "Projeto",
      castDisplayName,
    });

    const hasManualText =
      Boolean(form.subject.trim()) || Boolean(form.body.trim());
    if (hasManualText) {
      const confirmed = await confirm({
        title: "Substituir texto atual pelo template?",
        description:
          "Ao aplicar o template, o assunto e a mensagem atuais serão substituídos. Depois poderá editar livremente.",
        confirmLabel: "Aplicar template",
        cancelLabel: "Cancelar",
      });
      if (!confirmed) return;
    }

    setForm((prev) => ({
      ...prev,
      subject: nextTemplate.subject,
      body: nextTemplate.body,
      templateKey: nextTemplate.templateKey,
      recipientName: castDisplayName,
    }));
    setFeedbackTone("success");
    setFeedback(
      "Template aplicado. Pode editar o texto manualmente antes de guardar.",
    );
  };

  const sendableGroups = communicationGroups.filter((g) =>
    canOfferRealSendGroup(g),
  );

  const requestSendAll = async () => {
    if (sendableGroups.length === 0) return;
    setSendingAll(true);
    setFeedback(null);
    let okCount = 0;
    let failCount = 0;
    for (const group of sendableGroups) {
      const ok = await requestGroupSend(group, { silent: true });
      if (ok) okCount += 1;
      else failCount += 1;
    }
    await loadLogs();
    if (okCount === 0) {
      setFeedbackTone("error");
      setFeedback(
        "Nenhum envio foi aceite. Verifique os registos e tente novamente.",
      );
    } else if (failCount === 0) {
      setFeedbackTone("success");
      setFeedback(`Todos os envios foram aceites (${okCount}).`);
    } else {
      setFeedbackTone("info");
      setFeedback(`Envios aceites: ${okCount}. Falhas: ${failCount}.`);
    }
    setSendingAll(false);
  };

  const toneTextClass =
    feedbackTone === "error"
      ? "text-[#F09595]"
      : feedbackTone === "info"
        ? "text-[#7EC8E3]"
        : "text-[#5DCAA5]";

  const sessionForForm = sessions.find((s) => s.id === form.sessionId);
  const castForForm =
    castMembers.find((m) => m.id === form.castMemberId) ?? null;
  const sessionDualChannels =
    resolveSessionDualOutboundChannelsForUi(castForForm);

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="rounded-[10px] border border-[#252525] bg-[#1a1a1a] p-[14px]">
        <h2 className="text-[14px] font-[600] text-[#e8e8e8]">Comunicação</h2>
        <p className="mt-[4px] text-[11px] leading-[1.45] text-[#505050]">
          Histórico manual de contactos (e-mail, WhatsApp ou notas de canal
          sistema). Pode enviar de forma controlada por canal (E-mail/WhatsApp,
          saída) a partir da lista. Configure{" "}
          <code className="rounded bg-[#252525] px-[4px] text-[10px]">
            RESEND_API_KEY
          </code>{" "}
          (e-mail) e{" "}
          <code className="rounded bg-[#252525] px-[4px] text-[10px]">
            EVOLUTION_API_*
          </code>{" "}
          (WhatsApp) na API/worker.
        </p>
      </div>

      <div
        className="rounded-[10px] border border-[#252525] bg-[#1a1a1a] p-[14px]"
        role="group"
        aria-label="Novo ou editar registo de comunicação"
      >
        <div className="mb-[10px] flex flex-wrap items-center justify-between gap-[10px]">
          <h3 className="text-[12px] font-[600] text-[#e8e8e8]">
            {editingGroupId
              ? "Editar comunicação"
              : formMode === "new_from_session"
                ? "Novo registo (sessão)"
                : "Novo registo"}
          </h3>
          <div className="flex flex-wrap items-center gap-[6px]">
            {editingGroupId ? (
              <button
                type="button"
                onClick={onCancelEdit}
                className="rounded-[5px] border border-[#2e2e2e] px-[10px] py-[5px] text-[11px] text-[#909090] hover:bg-[#252525]"
              >
                Cancelar edição
              </button>
            ) : null}
            {!editingGroupId && formMode === "new_from_session" ? (
              <button
                type="button"
                onClick={clearManualForm}
                className="rounded-[5px] border border-[#2e2e2e] px-[10px] py-[5px] text-[11px] text-[#909090] hover:bg-[#252525]"
              >
                Limpar rascunho
              </button>
            ) : null}
          </div>
        </div>

        {formMode === "new_from_session" && !editingGroupId ? (
          <p className="mb-[10px] rounded-[6px] border border-[#0d3d2a] bg-[#0a2018] px-[10px] py-[8px] text-[11px] leading-[1.4] text-[#5DCAA5]">
            Dados da sessão e do dublador vêm da agenda e ficam alinhados ao
            registo. Pode editar assunto e mensagem; o envio real só ocorre se
            pedir a partir da lista (um pedido por comunicação, incluindo todos
            os canais).
          </p>
        ) : null}

        <div className="mb-[10px] rounded-[8px] border border-[#2e2e2e] bg-[#141414] p-[10px]">
          <div className="grid grid-cols-1 gap-[8px] md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label className={labelCls}>Template básico</label>
              <select
                className={inputCls}
                value={selectedTemplateType}
                onChange={(e) =>
                  setSelectedTemplateType(
                    e.target.value as CommunicationTemplateType,
                  )
                }
              >
                {COMMUNICATION_TEMPLATE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {COMMUNICATION_TEMPLATE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void applySelectedTemplate()}
              className="rounded-[5px] border border-[#2e2e2e] bg-[#101010] px-[10px] py-[7px] text-[11px] text-[#cfcfcf] hover:bg-[#252525]"
            >
              Aplicar template
            </button>
          </div>
          <p className="mt-[6px] text-[10px] text-[#606060]">
            {isSessionLockedFlow
              ? "A aplicação do template atualiza assunto e mensagem. Depois, pode editar o texto livremente."
              : "A aplicação do template atualiza assunto, mensagem e chave do template. Depois, pode editar o texto livremente."}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-[10px] md:grid-cols-2">
          {isSessionLockedFlow ? (
            <div className="md:col-span-2">
              <p className={labelCls}>Canais de envio</p>
              <div className="rounded-[6px] border border-[#2e2e2e] bg-[#141414] px-[10px] py-[8px]">
                <CommunicationChannelChipRow
                  channels={sessionDualChannels.channels}
                  emptyMessage={sessionDualChannels.warning}
                />
              </div>
              <p className="mt-[4px] text-[10px] text-[#606060]">
                Direção: saída (OUTBOUND). A API cria um registo por canal
                disponível no cadastro do dublador.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label className={labelCls}>Canal</label>
                <select
                  className={inputCls}
                  value={form.channel}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      channel: e.target.value as CommunicationChannel,
                    }))
                  }
                >
                  {CHANNELS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Direção</label>
                <select
                  className={inputCls}
                  value={form.direction}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      direction: e.target.value as CommunicationDirection,
                    }))
                  }
                >
                  {DIRECTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          <div>
            <label className={labelCls}>Assunto (opcional)</label>
            <input
              className={inputCls}
              value={form.subject}
              onChange={(e) =>
                setForm((f) => ({ ...f, subject: e.target.value }))
              }
              placeholder="Assunto"
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Mensagem / corpo</label>
            <textarea
              className={`${inputCls} min-h-[100px] resize-y`}
              value={form.body}
              onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="Texto do contacto ou nota interna"
              rows={5}
            />
          </div>
          <div>
            <label className={labelCls}>Destinatário (nome)</label>
            <input
              className={isSessionLockedFlow ? lockedFieldCls : inputCls}
              readOnly={isSessionLockedFlow}
              aria-readonly={isSessionLockedFlow}
              value={form.recipientName}
              onChange={(e) =>
                setForm((f) => ({ ...f, recipientName: e.target.value }))
              }
            />
          </div>
          <div>
            <label className={labelCls}>E-mail do destinatário</label>
            <input
              className={isSessionLockedFlow ? lockedFieldCls : inputCls}
              readOnly={isSessionLockedFlow}
              aria-readonly={isSessionLockedFlow}
              type="email"
              autoComplete="off"
              value={form.recipientEmail}
              onChange={(e) =>
                setForm((f) => ({ ...f, recipientEmail: e.target.value }))
              }
            />
          </div>
          <div>
            <label className={labelCls}>WhatsApp do destinatário</label>
            <input
              className={isSessionLockedFlow ? lockedFieldCls : inputCls}
              readOnly={isSessionLockedFlow}
              aria-readonly={isSessionLockedFlow}
              value={form.recipientWhatsapp}
              onChange={(e) =>
                setForm((f) => ({ ...f, recipientWhatsapp: e.target.value }))
              }
            />
          </div>
          {isSessionLockedFlow ? (
            <>
              <div>
                <p className={labelCls}>Sessão</p>
                <p className="rounded-[6px] border border-[#2e2e2e] bg-[#141414] px-[10px] py-[8px] text-[12px] text-[#c8c8c8]">
                  {sessionForForm?.title?.trim() || form.sessionId || "—"}
                </p>
              </div>
              <div className="md:col-span-2">
                <p className={labelCls}>Dublador</p>
                <p className="rounded-[6px] border border-[#2e2e2e] bg-[#141414] px-[10px] py-[8px] text-[12px] text-[#c8c8c8]">
                  {castForForm?.name?.trim() || form.castMemberId || "—"}
                </p>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className={labelCls}>Sessão (opcional)</label>
                <select
                  className={inputCls}
                  value={form.sessionId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sessionId: e.target.value }))
                  }
                >
                  <option value="">Nenhuma</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Dublador (opcional)</label>
                <select
                  className={inputCls}
                  value={form.castMemberId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, castMemberId: e.target.value }))
                  }
                >
                  <option value="">Nenhum</option>
                  {castMembers.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
          {!isSessionLockedFlow ? (
            <div>
              <label className={labelCls}>Chave de template (opcional)</label>
              <input
                className={inputCls}
                value={form.templateKey}
                onChange={(e) =>
                  setForm((f) => ({ ...f, templateKey: e.target.value }))
                }
                placeholder="Referência futura; sem motor de templates"
              />
            </div>
          ) : null}
        </div>

        {feedback ? (
          <p className={`mt-[12px] text-[11px] ${toneTextClass}`}>{feedback}</p>
        ) : null}

        <div className="mt-[12px] flex justify-end gap-[8px]">
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveCommunicationLog()}
            className="rounded-[5px] border border-[#0F6E56] bg-[#1D9E75] px-[14px] py-[6px] text-[11px] font-[500] text-white transition-colors hover:bg-[#0F6E56] disabled:opacity-40"
          >
            {saving
              ? "A guardar…"
              : editingGroupId
                ? "Guardar alterações"
                : isSessionLockedFlow
                  ? "Guardar comunicação"
                  : "Adicionar registo"}
          </button>
        </div>
      </div>

      <div className="rounded-[10px] border border-[#252525] bg-[#1a1a1a] p-[14px]">
        <h3 className="text-[12px] font-[600] text-[#e8e8e8]">Lista</h3>
        <div className="mt-[6px] flex flex-wrap items-center justify-between gap-[8px]">
          <p className="text-[10px] text-[#505050]">
            Envios só funcionam após salvar o registro.
          </p>
          <button
            type="button"
            disabled={
              sendingAll ||
              sendingGroupId !== null ||
              sendableGroups.length === 0
            }
            onClick={() => void requestSendAll()}
            className="rounded-[5px] border border-[#2e2e2e] bg-[#101010] px-[10px] py-[5px] text-[10px] text-[#d0d0d0] hover:bg-[#252525] disabled:opacity-40"
            title={
              sendableGroups.length === 0
                ? "Sem comunicações OUTBOUND com canais pendentes de envio"
                : "Enfileirar envio de todas as comunicações com canais pendentes"
            }
          >
            {sendingAll ? "A enviar..." : "Enviar todos"}
          </button>
        </div>
        {loading ? (
          <p className="mt-[8px] text-[12px] text-[#505050]">A carregar…</p>
        ) : communicationGroups.length === 0 ? (
          <p className="mt-[8px] text-[12px] text-[#505050]">
            Sem registos ainda.
          </p>
        ) : (
          <ul className="mt-[10px] flex flex-col gap-[8px]">
            {communicationGroups.map((group) => {
              const head = group.logs[0]!;
              const attemptsSum = group.logs.reduce(
                (a, l) => a + (l.sendAttemptCount ?? 0),
                0,
              );
              const outboundReal =
                group.direction === "OUTBOUND" &&
                group.channels.some((c) => c === "EMAIL" || c === "WHATSAPP");
              return (
                <li
                  key={group.groupId}
                  className="rounded-[8px] border border-[#2e2e2e] bg-[#141414] px-[12px] py-[10px]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-[8px]">
                    <div className="min-w-0 flex-1">
                      <div className="mb-[4px] flex flex-wrap items-center gap-[6px]">
                        <span
                          className={`rounded-full border px-[7px] py-[2px] text-[9px] font-[600] ${consolidatedStatusChipClass(group.consolidatedStatus)}`}
                        >
                          {consolidatedStatusLabel(group.consolidatedStatus)}
                        </span>
                        <CommunicationChannelChipRow
                          channels={group.channels}
                        />
                        <span className="rounded-full border border-[#3f3f3f] bg-[#202020] px-[7px] py-[2px] text-[9px] font-[600] text-[#b5b5b5]">
                          {group.direction}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-[8px] text-[10px] text-[#5f5f5f]">
                        <span>
                          {new Date(group.createdAt).toLocaleString()}
                        </span>
                        <span>Tentativas (soma): {attemptsSum}</span>
                        {group.logs.map((log) =>
                          log.sentAt ? (
                            <span key={log.id}>
                              {log.channel}: enviado{" "}
                              {new Date(log.sentAt).toLocaleString()}
                            </span>
                          ) : null,
                        )}
                      </div>
                      {group.subject?.trim() ? (
                        <p className="mt-[6px] text-[13px] font-[600] text-[#ececec]">
                          {group.subject}
                        </p>
                      ) : null}
                      <p className="mt-[5px] line-clamp-4 whitespace-pre-wrap text-[11px] text-[#8e8e8e]">
                        {group.body}
                      </p>
                      <div className="mt-[6px] flex flex-wrap gap-[8px] text-[10px] text-[#505050]">
                        {group.recipientName?.trim() ? (
                          <span>Para: {group.recipientName}</span>
                        ) : null}
                        {group.recipientEmail?.trim() ? (
                          <span>E-mail: {group.recipientEmail}</span>
                        ) : null}
                        {group.recipientWhatsapp?.trim() ? (
                          <span>WhatsApp: {group.recipientWhatsapp}</span>
                        ) : null}
                        {head.castMember ? (
                          <span>Dublador: {head.castMember.name}</span>
                        ) : null}
                        {head.session ? (
                          <span>Sessão: {head.session.title}</span>
                        ) : null}
                        {group.logs.map((log) =>
                          log.status === "PROCESSING" && log.nextRetryAt ? (
                            <span key={log.id}>
                              {log.channel} — próxima tentativa:{" "}
                              {new Date(log.nextRetryAt).toLocaleString()}
                            </span>
                          ) : null,
                        )}
                        {group.logs.map((log) =>
                          log.providerMessageId?.trim() ? (
                            <span
                              key={`p-${log.id}`}
                              title={log.providerMessageId}
                            >
                              {log.channel} ID:{" "}
                              {log.providerMessageId.slice(0, 14)}
                              {log.providerMessageId.length > 14 ? "…" : ""}
                            </span>
                          ) : null,
                        )}
                      </div>
                      {group.logs.map((log) =>
                        log.error?.trim() ? (
                          <p
                            key={`e-${log.id}`}
                            className="mt-[4px] text-[10px] text-[#E24B4A]"
                          >
                            {log.channel}: {log.error}
                          </p>
                        ) : null,
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-[6px]">
                      {canOfferRealSendGroup(group) ? (
                        <button
                          type="button"
                          disabled={
                            sendingGroupId === group.groupId ||
                            Boolean(deletingGroupId) ||
                            Boolean(saving)
                          }
                          onClick={() => void requestGroupSend(group)}
                          className="rounded-[5px] border border-[#0F6E56] bg-[#0d3d2a] px-[8px] py-[4px] text-[10px] text-[#5DCAA5] hover:bg-[#0a3020] disabled:opacity-40"
                        >
                          {sendingGroupId === group.groupId
                            ? "A pedir envio…"
                            : group.channels.filter(
                                  (c) => c === "EMAIL" || c === "WHATSAPP",
                                ).length > 1
                              ? "Enviar em todos os canais"
                              : "Enviar comunicação"}
                        </button>
                      ) : outboundReal &&
                        group.consolidatedStatus === "PROCESSANDO" ? (
                        <span
                          className="self-center text-[9px] text-[#b89a3c]"
                          title="O worker está a processar; atualize a lista para ver o resultado"
                        >
                          Na fila
                        </span>
                      ) : outboundReal &&
                        group.consolidatedStatus === "ENVIADO" ? (
                        <span
                          className="self-center text-[9px] text-[#505050]"
                          title="Todos os canais elegíveis foram enviados"
                        >
                          Enviado
                        </span>
                      ) : group.channels.includes("SYSTEM") &&
                        group.channels.length === 1 ? (
                        <span
                          className="self-center text-[9px] text-[#505050]"
                          title="Envio real não aplica a este canal"
                        >
                          Só leitura
                        </span>
                      ) : group.direction !== "OUTBOUND" ? (
                        <span className="self-center text-[9px] text-[#505050]">
                          —
                        </span>
                      ) : outboundReal ? (
                        <span
                          className="self-center text-[9px] text-[#505050]"
                          title="Complete destinatários e corpo, ou aguarde estado reenviável"
                        >
                          —
                        </span>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => onEdit(group)}
                        className="rounded-[5px] border border-[#2e2e2e] px-[8px] py-[4px] text-[10px] text-[#909090] hover:bg-[#252525]"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={deletingGroupId === group.groupId}
                        onClick={() => void onDelete(group)}
                        className="rounded-[5px] border border-[#5a1515] px-[8px] py-[4px] text-[10px] text-[#F09595] hover:bg-[#2a0a0a] disabled:opacity-40"
                      >
                        {deletingGroupId === group.groupId ? "…" : "Remover"}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
