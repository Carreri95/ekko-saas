import type { PrismaClient } from "../../../api/src/generated/prisma/client.js";
import {
  CommunicationChannel,
  CommunicationDirection,
  CommunicationStatus,
  PreferredCommunicationChannel,
  RecordingSessionFormat,
  RecordingSessionStatus,
} from "../../../api/src/generated/prisma/client.js";

const REMINDER_24H_TEMPLATE_KEY = "session_reminder_24h";
const REMINDER_2H_TEMPLATE_KEY = "session_reminder_2h";

const LOOKAHEAD_MIN_HOURS = 1;
const LOOKAHEAD_MAX_HOURS = 25;
const SESSION_QUERY_HARD_LIMIT = 200;

const HOUR_MS = 60 * 60 * 1000;

function log(event: string, payload: Record<string, unknown> = {}) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      scope: "session-reminder",
      event,
      ...payload,
    }),
  );
}

function pickChannelWithSimpleFallback(cast: {
  preferredCommunicationChannel: PreferredCommunicationChannel | null;
  email: string | null;
  whatsapp: string | null;
}): CommunicationChannel {
  const preferred = cast.preferredCommunicationChannel;
  const hasEmail = Boolean(cast.email?.trim());
  const hasWhatsapp = Boolean(cast.whatsapp?.trim());

  if (preferred === PreferredCommunicationChannel.WHATSAPP) {
    if (hasWhatsapp) return CommunicationChannel.WHATSAPP;
    if (hasEmail) return CommunicationChannel.EMAIL;
    return CommunicationChannel.WHATSAPP;
  }
  if (preferred === PreferredCommunicationChannel.EMAIL) {
    if (hasEmail) return CommunicationChannel.EMAIL;
    if (hasWhatsapp) return CommunicationChannel.WHATSAPP;
    return CommunicationChannel.EMAIL;
  }

  if (hasWhatsapp && !hasEmail) return CommunicationChannel.WHATSAPP;
  return CommunicationChannel.EMAIL;
}

function resolveReminderTemplateKey(startAt: Date, now: Date): string | null {
  const deltaMs = startAt.getTime() - now.getTime();

  if (deltaMs >= 23 * HOUR_MS && deltaMs <= 25 * HOUR_MS) {
    return REMINDER_24H_TEMPLATE_KEY;
  }
  if (deltaMs >= 1 * HOUR_MS && deltaMs <= 3 * HOUR_MS) {
    return REMINDER_2H_TEMPLATE_KEY;
  }
  return null;
}

function formatPtDateTime(startAt: Date): { dateStr: string; timeStr: string } {
  return {
    dateStr: startAt.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    timeStr: startAt.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

function formatSessionFormatPt(format: RecordingSessionFormat): string {
  return format === RecordingSessionFormat.REMOTE ? "Remoto" : "Presencial";
}

function buildReminderContent(input: {
  reminderTemplateKey: string;
  session: {
    title: string;
    startAt: Date;
    format: RecordingSessionFormat;
    project: { name: string };
  };
  castName: string;
}): { subject: string; body: string } {
  const { dateStr, timeStr } = formatPtDateTime(input.session.startAt);
  const lead =
    input.reminderTemplateKey === REMINDER_24H_TEMPLATE_KEY
      ? "Lembrete (24h):"
      : "Lembrete (2h):";

  const subject = `${lead} ${input.session.title} (${input.session.project.name})`;
  const body = [
    `Olá, ${input.castName}.`,
    "",
    `${lead} sua sessão de gravação "${input.session.title}" está marcada para ${dateStr} às ${timeStr}.`,
    "",
    `Projeto: ${input.session.project.name}`,
    `Formato: ${formatSessionFormatPt(input.session.format)}`,
  ].join("\n");

  return { subject, body };
}

export async function processSessionReminders(prisma: PrismaClient): Promise<boolean> {
  const now = new Date();
  const lookaheadStart = new Date(now.getTime() + LOOKAHEAD_MIN_HOURS * HOUR_MS);
  const lookaheadEnd = new Date(now.getTime() + LOOKAHEAD_MAX_HOURS * HOUR_MS);

  const sessions = await prisma.recordingSession.findMany({
    where: {
      startAt: {
        gte: lookaheadStart,
        lte: lookaheadEnd,
      },
      status: {
        not: RecordingSessionStatus.CANCELED,
      },
    },
    select: {
      id: true,
      projectId: true,
      episodeId: true,
      castMemberId: true,
      title: true,
      startAt: true,
      format: true,
      project: {
        select: {
          name: true,
        },
      },
      castMember: {
        select: {
          id: true,
          name: true,
          email: true,
          whatsapp: true,
          preferredCommunicationChannel: true,
        },
      },
    },
    orderBy: {
      startAt: "asc",
    },
    take: SESSION_QUERY_HARD_LIMIT,
  });

  if (sessions.length === 0) {
    return false;
  }

  const candidates = sessions
    .map((session) => {
      const reminderTemplateKey = resolveReminderTemplateKey(session.startAt, now);
      if (!reminderTemplateKey) return null;
      return { session, reminderTemplateKey };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (candidates.length === 0) {
    return false;
  }

  const existingLogs = await prisma.communicationLog.findMany({
    where: {
      sessionId: { in: candidates.map((c) => c.session.id) },
      templateKey: { in: [REMINDER_24H_TEMPLATE_KEY, REMINDER_2H_TEMPLATE_KEY] },
    },
    select: {
      sessionId: true,
      templateKey: true,
    },
  });
  const existingKeys = new Set(
    existingLogs
      .filter((r) => Boolean(r.sessionId && r.templateKey))
      .map((r) => `${r.sessionId}:${r.templateKey}`),
  );

  let createdCount = 0;
  for (const candidate of candidates) {
    const dedupKey = `${candidate.session.id}:${candidate.reminderTemplateKey}`;
    if (existingKeys.has(dedupKey)) {
      continue;
    }

    const cast = candidate.session.castMember;
    if (!cast) {
      log("skip_missing_cast_member", { sessionId: candidate.session.id });
      continue;
    }

    const channel = pickChannelWithSimpleFallback(cast);
    const recipientEmail = cast.email?.trim() ?? "";
    const recipientWhatsapp = cast.whatsapp?.trim() ?? "";
    const hasRecipient =
      channel === CommunicationChannel.EMAIL ? Boolean(recipientEmail) : Boolean(recipientWhatsapp);
    if (!hasRecipient) {
      log("skip_missing_recipient", {
        sessionId: candidate.session.id,
        castMemberId: cast.id,
        channel,
      });
      continue;
    }

    const castName = cast.name?.trim() || "Dublador";
    const template = buildReminderContent({
      reminderTemplateKey: candidate.reminderTemplateKey,
      session: candidate.session,
      castName,
    });

    try {
      await prisma.communicationLog.create({
        data: {
          channel,
          direction: CommunicationDirection.OUTBOUND,
          status: CommunicationStatus.PROCESSING,
          subject: template.subject,
          body: template.body,
          templateKey: candidate.reminderTemplateKey,
          recipientName: castName,
          recipientEmail: recipientEmail || null,
          recipientWhatsapp: recipientWhatsapp || null,
          dubbingProjectId: candidate.session.projectId,
          episodeId: candidate.session.episodeId ?? null,
          castMemberId: candidate.session.castMemberId,
          sessionId: candidate.session.id,
          error: null,
          providerMessageId: null,
          sendLockedAt: null,
          sendAttemptCount: 0,
          lastSendAttemptAt: null,
          nextRetryAt: null,
          sentAt: null,
        },
      });
      existingKeys.add(dedupKey);
      createdCount += 1;
    } catch (error) {
      log("create_failed", {
        sessionId: candidate.session.id,
        templateKey: candidate.reminderTemplateKey,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (createdCount > 0) {
    log("created", { createdCount });
    return true;
  }
  return false;
}
