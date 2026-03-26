import type { PrismaClient } from "../../../api/src/generated/prisma/client.js";
import { InviteEmailDispatchStatus } from "../../../api/src/generated/prisma/client.js";

import { getInviteEmailConfig } from "./env.js";
import { sendInviteEmailViaResend } from "./resend-send.js";

function log(event: string, payload: Record<string, unknown> = {}) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      scope: "invite-email-dispatch",
      event,
      ...payload,
    }),
  );
}

/**
 * Reclama um registo PENDING, envia email (Resend) e actualiza estado.
 * @returns true se processou um registo (evita sleep no loop principal).
 */
export async function processOneInviteEmailDispatch(
  prisma: PrismaClient,
): Promise<boolean> {
  const row = await prisma.$transaction(async (tx) => {
    const next = await tx.inviteEmailDispatch.findFirst({
      where: { status: InviteEmailDispatchStatus.PENDING },
      orderBy: { createdAt: "asc" },
      include: { invite: true },
    });
    if (!next) {
      return null;
    }

    const claimed = await tx.inviteEmailDispatch.updateMany({
      where: {
        id: next.id,
        status: InviteEmailDispatchStatus.PENDING,
      },
      data: {
        status: InviteEmailDispatchStatus.PROCESSING,
        attemptCount: { increment: 1 },
      },
    });

    if (claimed.count !== 1) {
      return null;
    }

    return next;
  });

  if (!row) {
    return false;
  }

  const { resendApiKey, emailFrom } = getInviteEmailConfig();

  if (!resendApiKey) {
    log("invite_email_skipped_no_api_key", { dispatchId: row.id, inviteId: row.inviteId });
    await prisma.inviteEmailDispatch.update({
      where: { id: row.id },
      data: {
        status: InviteEmailDispatchStatus.FAILED,
        lastError:
          "RESEND_API_KEY não definido. Defina a variável no worker ou consulte .env.example.",
      },
    });
    return true;
  }

  const inviteUrl = row.inviteUrl;
  if (!inviteUrl) {
    log("invite_email_missing_url", { dispatchId: row.id });
    await prisma.inviteEmailDispatch.update({
      where: { id: row.id },
      data: {
        status: InviteEmailDispatchStatus.FAILED,
        lastError: "inviteUrl em falta (estado inconsistente).",
      },
    });
    return true;
  }

  const send = await sendInviteEmailViaResend({
    apiKey: resendApiKey,
    from: emailFrom,
    toEmail: row.toEmail,
    inviteUrl,
    expiresAt: row.invite.expiresAt,
  });

  if (send.ok) {
    await prisma.inviteEmailDispatch.update({
      where: { id: row.id },
      data: {
        status: InviteEmailDispatchStatus.SENT,
        sentAt: new Date(),
        inviteUrl: null,
        lastError: null,
      },
    });
    log("invite_email_sent", { dispatchId: row.id, inviteId: row.inviteId });
    return true;
  }

  await prisma.inviteEmailDispatch.update({
    where: { id: row.id },
    data: {
      status: InviteEmailDispatchStatus.FAILED,
      lastError: send.message,
    },
  });
  log("invite_email_failed", {
    dispatchId: row.id,
    inviteId: row.inviteId,
    error: send.message,
  });
  return true;
}
