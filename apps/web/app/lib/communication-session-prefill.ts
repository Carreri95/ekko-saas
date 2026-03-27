import type { CastMemberDto } from "@/app/types/cast-member";
import type { CommunicationChannel } from "@/app/types/communication-log";
import type { RecordingSessionDto } from "@/app/types/recording-session";
import {
  buildSessionCommunicationTemplate,
  type CommunicationTemplateType,
} from "./communication-templates";

function pickDefaultChannel(cast: CastMemberDto | null): CommunicationChannel {
  if (cast?.whatsapp?.trim() && !cast?.email?.trim()) {
    return "WHATSAPP";
  }
  return "EMAIL";
}

export type CommunicationFormPrefill = {
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
  clientId: string;
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
    channel: pickDefaultChannel(cast),
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
    clientId: "",
    error: "",
  };
}
