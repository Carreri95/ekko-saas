import type { CastMemberDto } from "@/app/types/cast-member";
import type { CommunicationChannel } from "@/app/types/communication-log";
import type { RecordingSessionDto } from "@/app/types/recording-session";
import {
  buildSessionCommunicationTemplate,
  type CommunicationTemplateType,
} from "./communication-templates";

const DUAL_SUMMARY_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function dualSummaryWhatsappLooksValid(raw: string | null | undefined): boolean {
  const normalized = (raw ?? "").trim().replace(/[^\d+]/g, "");
  return /^\+?[1-9]\d{7,19}$/.test(normalized);
}

/**
 * Canais que a API usará no modo `sessionDualOutbound` (WhatsApp antes de e-mail, como na UI).
 */
export function resolveSessionDualOutboundChannelsForUi(cast: CastMemberDto | null): {
  channels: CommunicationChannel[];
  warning: string | null;
} {
  const emailRaw = cast?.email?.trim().toLowerCase() ?? "";
  const hasEmail = Boolean(emailRaw && DUAL_SUMMARY_EMAIL_RE.test(emailRaw));
  const hasWhatsapp = Boolean(
    cast?.whatsapp?.trim() && dualSummaryWhatsappLooksValid(cast.whatsapp),
  );
  if (!hasEmail && !hasWhatsapp) {
    return {
      channels: [],
      warning:
        "Nenhum canal disponível — cadastre e-mail ou WhatsApp válidos no dublador.",
    };
  }
  const channels: CommunicationChannel[] = [];
  if (hasWhatsapp) channels.push("WHATSAPP");
  if (hasEmail) channels.push("EMAIL");
  return { channels, warning: null };
}

export function pickChannelWithSimpleFallback(cast: CastMemberDto | null): CommunicationChannel {
  const hasEmail = Boolean(cast?.email?.trim());
  const hasWhatsapp = Boolean(cast?.whatsapp?.trim());
  const prefersEmail = Boolean(cast?.prefersEmail);
  const prefersWhatsapp = Boolean(cast?.prefersWhatsapp);

  if (prefersEmail && prefersWhatsapp) {
    if (hasEmail) return "EMAIL";
    if (hasWhatsapp) return "WHATSAPP";
    return "EMAIL";
  }
  if (prefersWhatsapp) {
    if (hasWhatsapp) return "WHATSAPP";
    if (hasEmail) return "EMAIL";
    return "WHATSAPP";
  }
  if (prefersEmail) {
    if (hasEmail) return "EMAIL";
    if (hasWhatsapp) return "WHATSAPP";
    return "EMAIL";
  }
  if (hasWhatsapp && !hasEmail) return "WHATSAPP";
  return "EMAIL";
}

export function resolveChannelsWithFallback(cast: CastMemberDto | null): CommunicationChannel[] {
  const hasEmail = Boolean(cast?.email?.trim());
  const hasWhatsapp = Boolean(cast?.whatsapp?.trim());
  const prefersEmail = Boolean(cast?.prefersEmail);
  const prefersWhatsapp = Boolean(cast?.prefersWhatsapp);
  const out: CommunicationChannel[] = [];

  if (prefersEmail && hasEmail) out.push("EMAIL");
  if (prefersWhatsapp && hasWhatsapp) out.push("WHATSAPP");

  if (out.length > 0) return out;

  if (hasEmail) out.push("EMAIL");
  if (hasWhatsapp) out.push("WHATSAPP");
  if (out.length > 0) return out;

  out.push(pickChannelWithSimpleFallback(cast));
  return out;
}

export type CommunicationFormPrefill = {
  channels: CommunicationChannel[];
  channel: CommunicationChannel;
  direction: "OUTBOUND";
  status: "PENDING";
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

/**
 * Estado inicial do formulário de CommunicationLog a partir de uma RecordingSession e dados do dublador.
 */
export function buildCommunicationFormPrefillFromSession(
  session: RecordingSessionDto,
  context: {
    projectName: string;
    castMember: CastMemberDto | null;
    templateType?: CommunicationTemplateType;
  },
): CommunicationFormPrefill {
  const cast = context.castMember;
  const nameFromSession = session.castMember?.name?.trim();
  const recipientName = (cast?.name ?? nameFromSession ?? "Dublador").trim();
  const template = buildSessionCommunicationTemplate({
    templateType: context.templateType ?? "SESSION_REMINDER",
    session,
    projectName: context.projectName,
    castDisplayName: recipientName,
  });

  return {
    channels: resolveChannelsWithFallback(cast),
    channel: pickChannelWithSimpleFallback(cast),
    direction: "OUTBOUND",
    status: "PENDING",
    subject: template.subject,
    body: template.body,
    templateKey: template.templateKey,
    recipientName,
    recipientEmail: cast?.email?.trim() ?? "",
    recipientWhatsapp: cast?.whatsapp?.trim() ?? "",
    sessionId: session.id,
    castMemberId: session.castMemberId,
    error: "",
  };
}
