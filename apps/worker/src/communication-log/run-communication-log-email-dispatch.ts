import type { PrismaClient } from "../../../api/src/generated/prisma/client.js";
import {
  CommunicationChannel,
  CommunicationDirection,
  CommunicationStatus,
} from "../../../api/src/generated/prisma/client.js";

import { sendCommunicationLogViaResend } from "../../../api/src/infrastructure/email/resend-send-communication-log.js";
import { sendCommunicationLogViaEvolution } from "../../../api/src/infrastructure/whatsapp/evolution-send-communication-log.js";
import { getInviteEmailConfig } from "../invite-email/env.js";

const MAX_SEND_ATTEMPTS = 3;
const STALE_SEND_LOCK_MS = 5 * 60 * 1000;
const RETRY_DELAY_MS_BY_ATTEMPT: Record<number, number> = {
  1: 30_000,
  2: 120_000,
};

function log(event: string, payload: Record<string, unknown> = {}) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      scope: "communication-log-dispatch",
      event,
      ...payload,
    }),
  );
}

function evolutionConfig() {
  return {
    apiUrl: process.env.EVOLUTION_API_URL?.trim() || "",
    apiKey: process.env.EVOLUTION_API_KEY?.trim() || "",
    instanceName: process.env.EVOLUTION_INSTANCE_NAME?.trim() || "",
  };
}

/**
 * Reclama um CommunicationLog em PROCESSING (e-mail OUTBOUND), envia via Resend, actualiza estado.
 * Retentativas simples até MAX_SEND_ATTEMPTS; lock antigo (worker morto a meio) é recuperado após STALE_SEND_LOCK_MS.
 */
export async function processOneCommunicationLogDispatch(
  prisma: PrismaClient,
): Promise<boolean> {
  const staleBefore = new Date(Date.now() - STALE_SEND_LOCK_MS);
  const now = new Date();

  const claimedId = await prisma.$transaction(async (tx) => {
    const next = await tx.communicationLog.findFirst({
      where: {
        channel: { in: [CommunicationChannel.EMAIL, CommunicationChannel.WHATSAPP] },
        direction: CommunicationDirection.OUTBOUND,
        status: CommunicationStatus.PROCESSING,
        AND: [
          {
            OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
          },
          {
            OR: [{ sendLockedAt: null }, { sendLockedAt: { lt: staleBefore } }],
          },
        ],
      },
      orderBy: { updatedAt: "asc" },
      select: { id: true },
    });
    if (!next) {
      return null;
    }

    const up = await tx.communicationLog.updateMany({
      where: {
        id: next.id,
        channel: { in: [CommunicationChannel.EMAIL, CommunicationChannel.WHATSAPP] },
        direction: CommunicationDirection.OUTBOUND,
        status: CommunicationStatus.PROCESSING,
        AND: [
          {
            OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
          },
          {
            OR: [{ sendLockedAt: null }, { sendLockedAt: { lt: staleBefore } }],
          },
        ],
      },
      data: {
        sendLockedAt: now,
        lastSendAttemptAt: now,
        sendAttemptCount: { increment: 1 },
      },
    });

    if (up.count !== 1) {
      return null;
    }

    return next.id;
  });

  if (!claimedId) {
    return false;
  }
  log("claimed", { communicationLogId: claimedId });

  const row = await prisma.communicationLog.findUnique({
    where: { id: claimedId },
  });

  if (!row || row.status !== CommunicationStatus.PROCESSING) {
    await prisma.communicationLog.update({
      where: { id: claimedId },
      data: { sendLockedAt: null },
    });
    return true;
  }

  if (row.providerMessageId) {
    await prisma.communicationLog.update({
      where: { id: claimedId },
      data: {
        status: CommunicationStatus.SENT,
        sentAt: row.sentAt ?? new Date(),
        error: null,
        sendLockedAt: null,
      },
    });
    log("already_has_provider_message_id", {
      communicationLogId: claimedId,
      channel: row.channel,
      providerMessageId: row.providerMessageId,
      attemptCount: row.sendAttemptCount,
    });
    return true;
  }

  const toEmail = row.recipientEmail?.trim() ?? "";
  const toWhatsapp = row.recipientWhatsapp?.trim() ?? "";
  const body = row.body.trim();
  const subject =
    row.subject?.trim() && row.subject.trim().length > 0
      ? row.subject.trim()
      : "(sem assunto)";

  if (!body) {
    await prisma.communicationLog.update({
      where: { id: claimedId },
      data: {
        status: CommunicationStatus.FAILED,
        error: "Corpo da mensagem em falta (estado inconsistente).",
        sendLockedAt: null,
        nextRetryAt: null,
      },
    });
    log("failed_terminal_invalid_payload", {
      communicationLogId: claimedId,
      channel: row.channel,
      attemptCount: row.sendAttemptCount,
    });
    return true;
  }

  log("attempt_started", {
    communicationLogId: claimedId,
    channel: row.channel,
    attemptCount: row.sendAttemptCount,
  });

  let send:
    | { ok: true; providerMessageId: string | null }
    | { ok: false; message: string };
  if (row.channel === CommunicationChannel.EMAIL) {
    if (!toEmail) {
      send = { ok: false, message: "Destinatário de e-mail em falta (estado inconsistente)." };
    } else {
      const { resendApiKey, emailFrom } = getInviteEmailConfig();
      if (!resendApiKey) {
        await prisma.communicationLog.update({
          where: { id: claimedId },
          data: {
            status: CommunicationStatus.FAILED,
            error:
              "RESEND_API_KEY não definido no worker. Defina a variável ou consulte .env.example.",
            sendLockedAt: null,
            nextRetryAt: null,
          },
        });
        log("missing_config", {
          communicationLogId: claimedId,
          channel: row.channel,
          attemptCount: row.sendAttemptCount,
          configKey: "RESEND_API_KEY",
        });
        return true;
      }
      send = await sendCommunicationLogViaResend({
        apiKey: resendApiKey,
        from: emailFrom,
        toEmail,
        subject,
        textBody: body,
      });
    }
  } else if (row.channel === CommunicationChannel.WHATSAPP) {
    if (!toWhatsapp) {
      send = { ok: false, message: "Destinatário de WhatsApp em falta (estado inconsistente)." };
    } else {
      const evo = evolutionConfig();
      if (!evo.apiUrl || !evo.apiKey || !evo.instanceName) {
        await prisma.communicationLog.update({
          where: { id: claimedId },
          data: {
            status: CommunicationStatus.FAILED,
            error:
              "Evolution API não configurada no worker (EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE_NAME).",
            sendLockedAt: null,
            nextRetryAt: null,
          },
        });
        log("missing_config", {
          communicationLogId: claimedId,
          channel: row.channel,
          attemptCount: row.sendAttemptCount,
          configKey: "EVOLUTION_API_*",
        });
        return true;
      }
      send = await sendCommunicationLogViaEvolution({
        apiUrl: evo.apiUrl,
        apiKey: evo.apiKey,
        instanceName: evo.instanceName,
        toWhatsapp,
        textBody: body,
      });
    }
  } else {
    await prisma.communicationLog.update({
      where: { id: claimedId },
      data: {
        status: CommunicationStatus.FAILED,
        error: `Canal não suportado para envio real: ${row.channel}`,
        sendLockedAt: null,
        nextRetryAt: null,
      },
    });
    log("failed_terminal_invalid_payload", {
      communicationLogId: claimedId,
      channel: row.channel,
      attemptCount: row.sendAttemptCount,
      reason: "unsupported_channel",
    });
    return true;
  }

  const attemptCount = row.sendAttemptCount;

  if (send.ok) {
    await prisma.communicationLog.update({
      where: { id: claimedId },
      data: {
        status: CommunicationStatus.SENT,
        sentAt: new Date(),
        error: null,
        providerMessageId: send.providerMessageId,
        sendLockedAt: null,
        nextRetryAt: null,
      },
    });
    log("sent", {
      communicationLogId: claimedId,
      channel: row.channel,
      attemptCount: row.sendAttemptCount,
      providerMessageId: send.providerMessageId,
    });
    return true;
  }

  const message = send.message;
  if (attemptCount >= MAX_SEND_ATTEMPTS) {
    await prisma.communicationLog.update({
      where: { id: claimedId },
      data: {
        status: CommunicationStatus.FAILED,
        error: message,
        sendLockedAt: null,
        nextRetryAt: null,
      },
    });
    log("failed_terminal", {
      communicationLogId: claimedId,
      channel: row.channel,
      error: message,
      attemptCount,
    });
  } else {
    const delayMs = RETRY_DELAY_MS_BY_ATTEMPT[attemptCount] ?? 300_000;
    const nextRetryAt = new Date(Date.now() + delayMs);
    await prisma.communicationLog.update({
      where: { id: claimedId },
      data: {
        sendLockedAt: null,
        error: message,
        nextRetryAt,
      },
    });
    log("retry_scheduled", {
      communicationLogId: claimedId,
      channel: row.channel,
      error: message,
      attemptCount,
      nextRetryAt: nextRetryAt.toISOString(),
      retryDelayMs: delayMs,
    });
  }

  return true;
}

// Compatibilidade com import antigo durante transição PR 25.
export const processOneCommunicationLogEmailDispatch = processOneCommunicationLogDispatch;
