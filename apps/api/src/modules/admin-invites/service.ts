import {
  InviteEmailDispatchStatus,
  Prisma,
} from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/db/prisma.client.js";
import { env } from "../../infrastructure/config/env.js";
import { generateSessionToken, hashSessionToken } from "../auth/session-token.js";

export type InviteListStatus = "pending" | "accepted" | "revoked" | "expired";

function deriveStatus(inv: {
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}): InviteListStatus {
  if (inv.acceptedAt) return "accepted";
  if (inv.revokedAt) return "revoked";
  if (inv.expiresAt.getTime() <= Date.now()) return "expired";
  return "pending";
}

function publicInviteFields(inv: {
  id: string;
  email: string;
  role: string;
  expiresAt: Date;
  createdAt: Date;
  invitedByUserId: string;
}) {
  return {
    id: inv.id,
    email: inv.email,
    role: inv.role,
    expiresAt: inv.expiresAt.toISOString(),
    createdAt: inv.createdAt.toISOString(),
    invitedByUserId: inv.invitedByUserId,
  };
}

function mapEmailDeliveryStatus(
  status: InviteEmailDispatchStatus,
): "pending" | "processing" | "sent" | "failed" {
  switch (status) {
    case InviteEmailDispatchStatus.PENDING:
      return "pending";
    case InviteEmailDispatchStatus.PROCESSING:
      return "processing";
    case InviteEmailDispatchStatus.SENT:
      return "sent";
    case InviteEmailDispatchStatus.FAILED:
      return "failed";
  }
}

export class AdminInviteService {
  /**
   * Política: não pode haver dois convites **ativos** (pendentes não expirados) para o mesmo email (índice BD).
   * Convites expirados ainda ocupam o índice; antes de criar, marcamo-los como revogados (`revokedAt`).
   * Se ainda existir convite pendente válido → 409 (bloquear, sem substituir automaticamente).
   */
  async createInvite(params: {
    adminUserId: string;
    emailRaw: string;
  }): Promise<
    | {
        ok: true;
        invite: ReturnType<typeof publicInviteFields>;
        inviteUrl: string;
      }
    | { ok: false; error: "email_registered" | "pending_exists" | "unique_violation" }
  > {
    const email = params.emailRaw.trim().toLowerCase();

    const existingUser = await prisma.user.findFirst({
      where: { email },
    });
    if (existingUser) {
      return { ok: false, error: "email_registered" };
    }

    const now = new Date();

    await prisma.invite.updateMany({
      where: {
        email,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { lt: now },
      },
      data: { revokedAt: now },
    });

    const blocking = await prisma.invite.findFirst({
      where: {
        email,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gte: now },
      },
    });
    if (blocking) {
      return { ok: false, error: "pending_exists" };
    }

    const plainToken = generateSessionToken();
    const tokenHash = hashSessionToken(plainToken);
    const expiresAt = new Date(Date.now() + env.inviteTtlSec * 1000);
    const base = env.publicWebOrigin.replace(/\/$/, "");
    const inviteUrl = `${base}/invite/accept?token=${encodeURIComponent(plainToken)}`;

    try {
      const invite = await prisma.$transaction(async (tx) => {
        const created = await tx.invite.create({
          data: {
            email,
            role: "USER",
            tokenHash,
            invitedByUserId: params.adminUserId,
            expiresAt,
          },
        });

        await tx.inviteEmailDispatch.create({
          data: {
            inviteId: created.id,
            toEmail: email,
            inviteUrl,
            status: InviteEmailDispatchStatus.PENDING,
          },
        });

        return created;
      });

      return {
        ok: true,
        invite: publicInviteFields(invite),
        inviteUrl,
      };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return { ok: false, error: "unique_violation" };
      }
      throw e;
    }
  }

  async listInvites(): Promise<{
    invites: Array<
      ReturnType<typeof publicInviteFields> & {
        status: InviteListStatus;
        emailDelivery: {
          status: "pending" | "processing" | "sent" | "failed";
          sentAt: string | null;
          /** Quando o email ainda não foi enviado, permite mostrar a data de enfileiramento. */
          createdAt: string;
          lastError: string | null;
        } | null;
      }
    >;
  }> {
    const rows = await prisma.invite.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        emailDispatch: {
          select: {
            status: true,
            sentAt: true,
            createdAt: true,
            lastError: true,
          },
        },
      },
    });

    return {
      invites: rows.map((inv) => ({
        ...publicInviteFields(inv),
        status: deriveStatus(inv),
        emailDelivery: inv.emailDispatch
          ? {
              status: mapEmailDeliveryStatus(inv.emailDispatch.status),
              sentAt: inv.emailDispatch.sentAt?.toISOString() ?? null,
              createdAt: inv.emailDispatch.createdAt.toISOString(),
              lastError: inv.emailDispatch.lastError,
            }
          : null,
      })),
    };
  }

  async revokeInvite(inviteId: string): Promise<
    | { ok: true }
    | {
        ok: false;
        error: "not_found" | "already_accepted" | "already_revoked";
      }
  > {
    const inv = await prisma.invite.findUnique({
      where: { id: inviteId },
    });
    if (!inv) {
      return { ok: false, error: "not_found" };
    }
    if (inv.acceptedAt) {
      return { ok: false, error: "already_accepted" };
    }
    if (inv.revokedAt) {
      return { ok: false, error: "already_revoked" };
    }

    await prisma.invite.update({
      where: { id: inviteId },
      data: { revokedAt: new Date() },
    });

    return { ok: true };
  }
}
