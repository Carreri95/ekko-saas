import type { CastMemberDto } from "@/app/types/cast-member";
import type { RecordingSessionDto } from "@/app/types/recording-session";
import { buildCommunicationFormPrefillFromSession } from "./communication-session-prefill";
import type { CommunicationTemplateType } from "./communication-templates";

export type SessionSaveEmailAutomationResult =
  | { kind: "skipped_no_email" }
  | { kind: "create_failed"; message: string }
  | { kind: "send_failed"; message: string }
  | { kind: "queued" };

/**
 * Após guardar a sessão: cria CommunicationLog (canal e-mail) e chama POST .../send (enfileirado no worker).
 * Reaproveita o pré-preenchimento da sessão; falhas de create/send não desfazem a sessão já persistida.
 */
export async function runSessionSaveEmailAutomation(params: {
  projectId: string;
  session: RecordingSessionDto;
  projectName: string;
  castMember: CastMemberDto | null;
  templateType?: CommunicationTemplateType;
}): Promise<SessionSaveEmailAutomationResult> {
  const prefill = buildCommunicationFormPrefillFromSession(params.session, {
    projectName: params.projectName,
    castMember: params.castMember,
    templateType: params.templateType ?? "SESSION_CREATED",
  });

  const email = prefill.recipientEmail?.trim();
  if (!email) {
    return { kind: "skipped_no_email" };
  }

  const createBody = {
    channel: "EMAIL" as const,
    direction: prefill.direction,
    status: prefill.status,
    subject: prefill.subject.trim() || undefined,
    body: prefill.body,
    templateKey: `${prefill.templateKey}:auto_on_save`,
    recipientName: prefill.recipientName.trim() || undefined,
    recipientEmail: email,
    recipientWhatsapp: prefill.recipientWhatsapp.trim() || undefined,
    sessionId: prefill.sessionId || null,
    castMemberId: prefill.castMemberId || null,
    clientId: prefill.clientId || null,
  };

  const createRes = await fetch(
    `/api/dubbing-projects/${encodeURIComponent(params.projectId)}/communication-logs`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createBody),
    },
  );

  const createData = (await createRes.json().catch(() => ({}))) as {
    error?: string;
    log?: { id: string };
  };

  if (!createRes.ok || !createData.log?.id) {
    return {
      kind: "create_failed",
      message:
        typeof createData.error === "string"
          ? createData.error
          : "Não foi possível criar o registo de comunicação.",
    };
  }

  const logId = createData.log.id;

  const sendRes = await fetch(
    `/api/dubbing-projects/${encodeURIComponent(params.projectId)}/communication-logs/${encodeURIComponent(logId)}/send`,
    { method: "POST" },
  );

  const sendData = (await sendRes.json().catch(() => ({}))) as {
    error?: string;
    queued?: boolean;
  };

  if (!sendRes.ok) {
    return {
      kind: "send_failed",
      message:
        typeof sendData.error === "string"
          ? sendData.error
          : "Não foi possível pedir o envio do e-mail.",
    };
  }

  return { kind: "queued" };
}
