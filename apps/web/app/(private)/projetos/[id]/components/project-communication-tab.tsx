"use client";

import { useConfirm } from "@/app/components/confirm-provider";
import type { CastMemberDto } from "@/app/types/cast-member";
import type { ClientDto } from "@/app/types/client";
import type {
  CommunicationChannel,
  CommunicationDirection,
  CommunicationLogDto,
  CommunicationStatus,
} from "@/app/types/communication-log";
import type { RecordingSessionDto } from "@/app/types/recording-session";
import type { CommunicationFormPrefill } from "@/app/lib/communication-session-prefill";
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

function communicationStatusLabel(status: CommunicationStatus): string {
  switch (status) {
    case "PENDING":
      return "Pendente";
    case "PROCESSING":
      return "Na fila / a processar";
    case "SENT":
      return "Enviado";
    case "RECEIVED":
      return "Recebido";
    case "FAILED":
      return "Falhou";
    default:
      return status;
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
  clientId: string;
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
  clientId: "",
  error: "",
});

function logToForm(log: CommunicationLogDto): FormState {
  return {
    channel: log.channel,
    direction: log.direction,
    status: log.status,
    subject: log.subject ?? "",
    body: log.body,
    templateKey: log.templateKey ?? "",
    recipientName: log.recipientName ?? "",
    recipientEmail: log.recipientEmail ?? "",
    recipientWhatsapp: log.recipientWhatsapp ?? "",
    sessionId: log.sessionId ?? "",
    castMemberId: log.castMemberId ?? "",
    clientId: log.clientId ?? "",
    error: log.error ?? "",
  };
}

type FormMode = "new_manual" | "new_from_session" | "edit";

/** Envio real (PR 25): EMAIL/WHATSAPP outbound com destinatário e corpo preenchidos. */
function canOfferRealSend(log: CommunicationLogDto): boolean {
  if ((log.channel !== "EMAIL" && log.channel !== "WHATSAPP") || log.direction !== "OUTBOUND") {
    return false;
  }
  if (log.status === "SENT" || log.status === "RECEIVED" || log.status === "PROCESSING") {
    return false;
  }
  if (log.channel === "EMAIL") {
    return Boolean(log.recipientEmail?.trim()) && Boolean(log.body?.trim());
  }
  return Boolean(log.recipientWhatsapp?.trim()) && Boolean(log.body?.trim());
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

  const [clients, setClients] = useState<ClientDto[]>([]);
  const [logs, setLogs] = useState<CommunicationLogDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackTone, setFeedbackTone] = useState<"success" | "error" | "info">("success");
  const [form, setForm] = useState<FormState>(emptyForm);
  const [formMode, setFormMode] = useState<FormMode>("new_manual");
  const [selectedTemplateType, setSelectedTemplateType] =
    useState<CommunicationTemplateType>("SESSION_REMINDER");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sendingLogId, setSendingLogId] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/dubbing-projects/${encodeURIComponent(projectId)}/communication-logs`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        setLogs([]);
        setFeedbackTone("error");
        setFeedback("Não foi possível carregar o histórico de comunicação.");
        return;
      }
      const data = (await res.json()) as { logs: CommunicationLogDto[] };
      setLogs(data.logs ?? []);
    } catch {
      setLogs([]);
      setFeedbackTone("error");
      setFeedback("Falha de rede ao carregar comunicação.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const requestLogSend = async (
    log: CommunicationLogDto,
    options?: { silent?: boolean },
  ): Promise<boolean> => {
    const silent = options?.silent === true;
    if (!silent) setSendingLogId(log.id);
    try {
      const res = await fetch(
        `/api/dubbing-projects/${encodeURIComponent(projectId)}/communication-logs/${encodeURIComponent(log.id)}/send`,
        { method: "POST" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        queued?: boolean;
      };
      if (!res.ok) {
        if (!silent) {
          setFeedbackTone("error");
          setFeedback(
            data.error ??
              `Não foi possível pedir o envio ${
                log.channel === "WHATSAPP" ? "do WhatsApp" : "do e-mail"
              }.`,
          );
        }
        return false;
      }
      if (!silent) {
        setFeedbackTone("success");
        setFeedback(
          `Pedido de envio aceite. ${
            log.channel === "WHATSAPP" ? "O WhatsApp" : "O e-mail"
          } será enviado em breve (ver estado na lista).`,
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
        setSendingLogId(null);
      }
    }
  };

  const loadClients = useCallback(async () => {
    try {
      const res = await fetch("/api/clients", { cache: "no-store" });
      if (!res.ok) {
        setClients([]);
        return;
      }
      const data = (await res.json()) as { clients: ClientDto[] };
      setClients(data.clients ?? []);
    } catch {
      setClients([]);
    }
  }, []);

  useEffect(() => {
    void loadLogs();
    void loadClients();
  }, [loadLogs, loadClients]);

  useEffect(() => {
    if (!communicationDraft) return;
    const draftTemplateType = inferTemplateTypeFromKey(communicationDraft.prefill.templateKey);
    setForm({
      ...emptyForm(),
      ...communicationDraft.prefill,
    });
    setSelectedTemplateType(draftTemplateType);
    setEditingId(null);
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

  const buildCreateBody = () => ({
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
    clientId: form.clientId.trim() || null,
  });

  const buildPatchBody = () => ({
    channel: form.channel,
    direction: form.direction,
    subject: form.subject.trim() ? form.subject.trim() : null,
    body: form.body.trim(),
    templateKey: form.templateKey.trim() ? form.templateKey.trim() : null,
    recipientName: form.recipientName.trim() ? form.recipientName.trim() : null,
    recipientEmail: form.recipientEmail.trim() ? form.recipientEmail.trim() : null,
    recipientWhatsapp: form.recipientWhatsapp.trim() ? form.recipientWhatsapp.trim() : null,
    sessionId: form.sessionId.trim() || null,
    castMemberId: form.castMemberId.trim() || null,
    clientId: form.clientId.trim() || null,
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
      if (editingId) {
        const res = await fetch(
          `/api/dubbing-projects/${encodeURIComponent(projectId)}/communication-logs/${encodeURIComponent(editingId)}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildPatchBody()),
          },
        );
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          setFeedbackTone("error");
          setFeedback(err.error ?? "Não foi possível atualizar o registo.");
          return;
        }
        setFeedbackTone("success");
        setFeedback("Registo atualizado.");
        setEditingId(null);
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
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          setFeedbackTone("error");
          setFeedback(err.error ?? "Não foi possível criar o registo.");
          return;
        }
        setFeedbackTone("success");
        setFeedback("Registo criado.");
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

  const onEdit = (log: CommunicationLogDto) => {
    setEditingId(log.id);
    setForm(logToForm(log));
    setSelectedTemplateType(inferTemplateTypeFromKey(log.templateKey));
    setFormMode("edit");
    setFeedback(null);
  };

  const onCancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm());
    setSelectedTemplateType("SESSION_REMINDER");
    setFormMode("new_manual");
    setFeedback(null);
  };

  const onDelete = async (log: CommunicationLogDto) => {
    const ok = await confirm({
      title: "Remover registo de comunicação?",
      description: "Esta ação não pode ser desfeita.",
      confirmLabel: "Remover",
      cancelLabel: "Cancelar",
      variant: "danger",
    });
    if (!ok) return;
    setDeletingId(log.id);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/dubbing-projects/${encodeURIComponent(projectId)}/communication-logs/${encodeURIComponent(log.id)}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        setFeedbackTone("error");
        setFeedback("Não foi possível remover o registo.");
        return;
      }
      if (editingId === log.id) onCancelEdit();
      setFeedbackTone("success");
      setFeedback("Registo removido.");
      await loadLogs();
    } catch {
      setFeedbackTone("error");
      setFeedback("Falha de rede ao remover.");
    } finally {
      setDeletingId(null);
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

    const hasManualText = Boolean(form.subject.trim()) || Boolean(form.body.trim());
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
    setFeedback("Template aplicado. Pode editar o texto manualmente antes de guardar.");
  };

  const sendableLogs = logs.filter(
    (log) =>
      log.direction === "OUTBOUND" &&
      (log.status === "PENDING" || log.status === "FAILED"),
  );

  const requestSendAll = async () => {
    if (sendableLogs.length === 0) return;
    setSendingAll(true);
    setFeedback(null);
    let okCount = 0;
    let failCount = 0;
    for (const log of sendableLogs) {
      // Sequencial para reduzir rajadas no endpoint e manter UX previsível.
      const ok = await requestLogSend(log, { silent: true });
      if (ok) okCount += 1;
      else failCount += 1;
    }
    await loadLogs();
    if (okCount === 0) {
      setFeedbackTone("error");
      setFeedback("Nenhum envio foi aceite. Verifique os registos e tente novamente.");
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

  const statusChipClass = (status: CommunicationStatus): string => {
    switch (status) {
      case "PENDING":
        return "border-[#3b3b3b] bg-[#262626] text-[#b0b0b0]";
      case "PROCESSING":
        return "border-[#1a4d6e] bg-[#152a3d] text-[#7EC8E3]";
      case "SENT":
        return "border-[#0F6E56] bg-[#0d3d2a] text-[#5DCAA5]";
      case "FAILED":
        return "border-[#5a1515] bg-[#2a0a0a] text-[#F09595]";
      case "RECEIVED":
        return "border-[#454545] bg-[#2a2a2a] text-[#c4c4c4]";
      default:
        return "border-[#3b3b3b] bg-[#262626] text-[#b0b0b0]";
    }
  };

  const channelChipClass = (channel: CommunicationChannel): string => {
    switch (channel) {
      case "EMAIL":
        return "border-[#315d7a] bg-[#1a3144] text-[#a7d8f0]";
      case "WHATSAPP":
        return "border-[#1d7043] bg-[#173626] text-[#72d89a]";
      default:
        return "border-[#4a4a4a] bg-[#2a2a2a] text-[#bdbdbd]";
    }
  };

  return (
    <div className="flex flex-col gap-[14px]">
      <div className="rounded-[10px] border border-[#252525] bg-[#1a1a1a] p-[14px]">
        <h2 className="text-[14px] font-[600] text-[#e8e8e8]">Comunicação</h2>
        <p className="mt-[4px] text-[11px] leading-[1.45] text-[#505050]">
          Histórico manual de contactos (e-mail, WhatsApp ou notas de canal sistema). Pode enviar de
          forma controlada por canal (E-mail/WhatsApp, saída) a partir da lista. Configure{" "}
          <code className="rounded bg-[#252525] px-[4px] text-[10px]">RESEND_API_KEY</code> (e-mail)
          e{" "}
          <code className="rounded bg-[#252525] px-[4px] text-[10px]">EVOLUTION_API_*</code>{" "}
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
            {editingId
              ? "Editar registo"
              : formMode === "new_from_session"
                ? "Novo registo (sessão)"
                : "Novo registo"}
          </h3>
          <div className="flex flex-wrap items-center gap-[6px]">
            {editingId ? (
              <button
                type="button"
                onClick={onCancelEdit}
                className="rounded-[5px] border border-[#2e2e2e] px-[10px] py-[5px] text-[11px] text-[#909090] hover:bg-[#252525]"
              >
                Cancelar edição
              </button>
            ) : null}
            {!editingId && formMode === "new_from_session" ? (
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

        {formMode === "new_from_session" && !editingId ? (
          <p className="mb-[10px] rounded-[6px] border border-[#0d3d2a] bg-[#0a2018] px-[10px] py-[8px] text-[11px] leading-[1.4] text-[#5DCAA5]">
            Este formulário foi preenchido automaticamente a partir da sessão de gravação. Pode
            alterar qualquer campo antes de guardar — nada é enviado automaticamente.
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
                  setSelectedTemplateType(e.target.value as CommunicationTemplateType)
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
            A aplicação do template atualiza assunto, mensagem e chave do template. Depois, pode editar
            o texto livremente.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-[10px] md:grid-cols-2">
          <div>
            <label className={labelCls}>Canal</label>
            <select
              className={inputCls}
              value={form.channel}
              onChange={(e) =>
                setForm((f) => ({ ...f, channel: e.target.value as CommunicationChannel }))
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
          <div>
            <label className={labelCls}>Assunto (opcional)</label>
            <input
              className={inputCls}
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
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
              className={inputCls}
              value={form.recipientName}
              onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelCls}>E-mail do destinatário</label>
            <input
              className={inputCls}
              type="email"
              autoComplete="off"
              value={form.recipientEmail}
              onChange={(e) => setForm((f) => ({ ...f, recipientEmail: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelCls}>WhatsApp do destinatário</label>
            <input
              className={inputCls}
              value={form.recipientWhatsapp}
              onChange={(e) =>
                setForm((f) => ({ ...f, recipientWhatsapp: e.target.value }))
              }
            />
          </div>
          <div>
            <label className={labelCls}>Sessão (opcional)</label>
            <select
              className={inputCls}
              value={form.sessionId}
              onChange={(e) => setForm((f) => ({ ...f, sessionId: e.target.value }))}
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
              onChange={(e) => setForm((f) => ({ ...f, castMemberId: e.target.value }))}
            >
              <option value="">Nenhum</option>
              {castMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Cliente (opcional)</label>
            <select
              className={inputCls}
              value={form.clientId}
              onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}
            >
              <option value="">Nenhum</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Chave de template (opcional)</label>
            <input
              className={inputCls}
              value={form.templateKey}
              onChange={(e) => setForm((f) => ({ ...f, templateKey: e.target.value }))}
              placeholder="Referência futura; sem motor de templates"
            />
          </div>
        </div>

        {feedback ? (
          <p className={`mt-[12px] text-[11px] ${toneTextClass}`}>
            {feedback}
          </p>
        ) : null}

        <div className="mt-[12px] flex justify-end gap-[8px]">
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveCommunicationLog()}
            className="rounded-[5px] border border-[#0F6E56] bg-[#1D9E75] px-[14px] py-[6px] text-[11px] font-[500] text-white transition-colors hover:bg-[#0F6E56] disabled:opacity-40"
          >
            {saving ? "A guardar…" : editingId ? "Guardar alterações" : "Adicionar registo"}
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
            disabled={sendingAll || sendingLogId !== null || sendableLogs.length === 0}
            onClick={() => void requestSendAll()}
            className="rounded-[5px] border border-[#2e2e2e] bg-[#101010] px-[10px] py-[5px] text-[10px] text-[#d0d0d0] hover:bg-[#252525] disabled:opacity-40"
            title={
              sendableLogs.length === 0
                ? "Sem registos OUTBOUND com estado PENDING/FAILED para enviar"
                : "Enviar todos os registos OUTBOUND PENDING/FAILED"
            }
          >
            {sendingAll ? "A enviar..." : "Enviar todos"}
          </button>
        </div>
        {loading ? (
          <p className="mt-[8px] text-[12px] text-[#505050]">A carregar…</p>
        ) : logs.length === 0 ? (
          <p className="mt-[8px] text-[12px] text-[#505050]">Sem registos ainda.</p>
        ) : (
          <ul className="mt-[10px] flex flex-col gap-[8px]">
            {logs.map((log) => (
              <li
                key={log.id}
                className="rounded-[8px] border border-[#2e2e2e] bg-[#141414] px-[12px] py-[10px]"
              >
                <div className="flex flex-wrap items-start justify-between gap-[8px]">
                  <div className="min-w-0 flex-1">
                    <div className="mb-[4px] flex flex-wrap items-center gap-[6px]">
                      <span
                        className={`rounded-full border px-[7px] py-[2px] text-[9px] font-[600] ${statusChipClass(log.status)}`}
                      >
                        {communicationStatusLabel(log.status)}
                      </span>
                      <span
                        className={`rounded-full border px-[7px] py-[2px] text-[9px] font-[600] ${channelChipClass(log.channel)}`}
                      >
                        {log.channel}
                      </span>
                      <span className="rounded-full border border-[#3f3f3f] bg-[#202020] px-[7px] py-[2px] text-[9px] font-[600] text-[#b5b5b5]">
                        {log.direction}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-[8px] text-[10px] text-[#5f5f5f]">
                      <span>{new Date(log.createdAt).toLocaleString()}</span>
                      <span>Tentativas: {log.sendAttemptCount ?? 0}</span>
                      {log.sentAt ? <span>Enviado: {new Date(log.sentAt).toLocaleString()}</span> : null}
                    </div>
                    {log.subject?.trim() ? (
                      <p className="mt-[6px] text-[13px] font-[600] text-[#ececec]">
                        {log.subject}
                      </p>
                    ) : null}
                    <p className="mt-[5px] line-clamp-4 whitespace-pre-wrap text-[11px] text-[#8e8e8e]">
                      {log.body}
                    </p>
                    <div className="mt-[6px] flex flex-wrap gap-[8px] text-[10px] text-[#505050]">
                      {log.recipientName?.trim() ? <span>Para: {log.recipientName}</span> : null}
                      {log.channel === "EMAIL" && log.recipientEmail?.trim() ? (
                        <span>{log.recipientEmail}</span>
                      ) : null}
                      {log.channel === "WHATSAPP" && log.recipientWhatsapp?.trim() ? (
                        <span>{log.recipientWhatsapp}</span>
                      ) : null}
                      {log.castMember ? <span>Dublador: {log.castMember.name}</span> : null}
                      {log.client ? <span>Cliente: {log.client.name}</span> : null}
                      {log.session ? <span>Sessão: {log.session.title}</span> : null}
                      {log.status === "PROCESSING" && log.nextRetryAt ? (
                        <span>
                          Próxima tentativa: {new Date(log.nextRetryAt).toLocaleString()}
                        </span>
                      ) : null}
                      {log.providerMessageId?.trim() ? (
                        <span title={log.providerMessageId}>
                          Provider ID: {log.providerMessageId.slice(0, 18)}
                          {log.providerMessageId.length > 18 ? "..." : ""}
                        </span>
                      ) : null}
                    </div>
                    {log.error?.trim() ? (
                      <p className="mt-[4px] text-[10px] text-[#E24B4A]">Erro: {log.error}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap justify-end gap-[6px]">
                    {canOfferRealSend(log) ? (
                      <button
                        type="button"
                        disabled={
                          sendingLogId === log.id ||
                          Boolean(deletingId) ||
                          Boolean(saving)
                        }
                        onClick={() => void requestLogSend(log)}
                        className="rounded-[5px] border border-[#0F6E56] bg-[#0d3d2a] px-[8px] py-[4px] text-[10px] text-[#5DCAA5] hover:bg-[#0a3020] disabled:opacity-40"
                      >
                        {sendingLogId === log.id
                          ? "A pedir envio…"
                          : log.channel === "WHATSAPP"
                            ? "Enviar WhatsApp"
                            : log.channel === "EMAIL"
                              ? "Enviar e-mail"
                              : "Enviar"}
                      </button>
                    ) : (log.channel === "EMAIL" || log.channel === "WHATSAPP") &&
                      log.direction === "OUTBOUND" &&
                      log.status === "PROCESSING" ? (
                      <span
                        className="self-center text-[9px] text-[#b89a3c]"
                        title="O worker está a processar o envio; atualize a lista para ver o resultado"
                      >
                        Na fila
                      </span>
                    ) : (log.channel === "EMAIL" || log.channel === "WHATSAPP") &&
                      log.direction === "OUTBOUND" &&
                      log.status === "SENT" ? (
                      <span
                        className="self-center text-[9px] text-[#505050]"
                        title="Este registo já foi enviado"
                      >
                        Enviado
                      </span>
                    ) : log.channel === "SYSTEM" ? (
                      <span
                        className="self-center text-[9px] text-[#505050]"
                        title="Envio real não aplica a este canal"
                      >
                        Só leitura
                      </span>
                    ) : log.direction !== "OUTBOUND" ? (
                      <span
                        className="self-center text-[9px] text-[#505050]"
                        title="Envio por e-mail só para comunicação de saída"
                      >
                        —
                      </span>
                    ) : (log.channel === "EMAIL" || log.channel === "WHATSAPP") &&
                      log.direction === "OUTBOUND" ? (
                      <span
                        className="self-center text-[9px] text-[#505050]"
                        title="Guarde o registo com e-mail e corpo preenchidos, ou aguarde estado pendente/falha reenviável"
                      >
                        —
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onEdit(log)}
                      className="rounded-[5px] border border-[#2e2e2e] px-[8px] py-[4px] text-[10px] text-[#909090] hover:bg-[#252525]"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === log.id}
                      onClick={() => void onDelete(log)}
                      className="rounded-[5px] border border-[#5a1515] px-[8px] py-[4px] text-[10px] text-[#F09595] hover:bg-[#2a0a0a] disabled:opacity-40"
                    >
                      {deletingId === log.id ? "…" : "Remover"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
