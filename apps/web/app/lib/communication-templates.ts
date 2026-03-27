import type { RecordingSessionDto } from "@/app/types/recording-session";

export const COMMUNICATION_TEMPLATE_TYPES = [
  "SESSION_CREATED",
  "SESSION_UPDATED",
  "SESSION_REMINDER",
  "SESSION_CANCELED",
] as const;

export type CommunicationTemplateType = (typeof COMMUNICATION_TEMPLATE_TYPES)[number];

export const COMMUNICATION_TEMPLATE_LABELS: Record<CommunicationTemplateType, string> = {
  SESSION_CREATED: "Sessão criada",
  SESSION_UPDATED: "Sessão atualizada",
  SESSION_REMINDER: "Lembrete de sessão",
  SESSION_CANCELED: "Sessão cancelada",
};

export type SessionCommunicationTemplateInput = {
  templateType: CommunicationTemplateType;
  session: RecordingSessionDto;
  projectName: string;
  castDisplayName: string;
};

function formatSessionFormatPt(format: RecordingSessionDto["format"]): string {
  return format === "REMOTE" ? "Remoto" : "Presencial";
}

function formatSessionDateTime(startAt: string): { dateStr: string; timeStr: string } {
  const start = new Date(startAt);
  return {
    dateStr: start.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    timeStr: start.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function episodeSummaryLine(session: RecordingSessionDto): string {
  const eps =
    session.episodes && session.episodes.length > 0
      ? session.episodes
      : session.episode
        ? [session.episode]
        : [];
  if (eps.length === 0) return "";
  return eps
    .map((e) => {
      const num = e.number != null ? `EP${String(e.number).padStart(2, "0")}` : "";
      const t = e.title?.trim();
      return [num, t].filter(Boolean).join(" — ");
    })
    .filter(Boolean)
    .join("; ");
}

function templateKeyFromType(templateType: CommunicationTemplateType): string {
  switch (templateType) {
    case "SESSION_CREATED":
      return "session_created";
    case "SESSION_UPDATED":
      return "session_updated";
    case "SESSION_REMINDER":
      return "session_reminder";
    case "SESSION_CANCELED":
      return "session_canceled";
    default:
      return "session_reminder";
  }
}

export function inferTemplateTypeFromKey(
  templateKey: string | null | undefined,
): CommunicationTemplateType {
  const key = templateKey?.trim().toLowerCase() ?? "";
  if (key.startsWith("session_created")) return "SESSION_CREATED";
  if (key.startsWith("session_updated")) return "SESSION_UPDATED";
  if (key.startsWith("session_canceled")) return "SESSION_CANCELED";
  return "SESSION_REMINDER";
}

function subjectPrefix(templateType: CommunicationTemplateType): string {
  switch (templateType) {
    case "SESSION_CREATED":
      return "Sessão agendada";
    case "SESSION_UPDATED":
      return "Sessão atualizada";
    case "SESSION_REMINDER":
      return "Lembrete de sessão";
    case "SESSION_CANCELED":
      return "Sessão cancelada";
    default:
      return "Sessão";
  }
}

export function buildSessionCommunicationTemplate(input: SessionCommunicationTemplateInput): {
  templateKey: string;
  subject: string;
  body: string;
} {
  const { templateType, session, projectName, castDisplayName } = input;
  const { dateStr, timeStr } = formatSessionDateTime(session.startAt);
  const epLine = episodeSummaryLine(session);
  const formatLabel = formatSessionFormatPt(session.format);

  const headlineByType: Record<CommunicationTemplateType, string> = {
    SESSION_CREATED: `Sua sessão de gravação "${session.title}" foi agendada para ${dateStr} às ${timeStr}.`,
    SESSION_UPDATED: `Sua sessão de gravação "${session.title}" foi atualizada para ${dateStr} às ${timeStr}.`,
    SESSION_REMINDER: `Lembrete: sua sessão de gravação "${session.title}" está marcada para ${dateStr} às ${timeStr}.`,
    SESSION_CANCELED: `A sessão de gravação "${session.title}" foi cancelada.`,
  };

  const lines = [
    `Olá, ${castDisplayName}.`,
    "",
    headlineByType[templateType],
    "",
    `Projeto: ${projectName}`,
    `Formato: ${formatLabel}`,
  ];
  if (epLine) lines.push(`Episódios: ${epLine}`);

  return {
    templateKey: templateKeyFromType(templateType),
    subject: `${subjectPrefix(templateType)} — ${session.title} (${projectName})`,
    body: lines.join("\n"),
  };
}
