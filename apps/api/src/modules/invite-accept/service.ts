import bcrypt from "bcryptjs";
import { Prisma } from "../../generated/prisma/client.js";
import type { FastifyReply } from "fastify";
import type { AuthMeResponse } from "@subtitlebot/shared";
import { prisma } from "../../infrastructure/db/prisma.client.js";
import { AuthService } from "../auth/service.js";
import { hashSessionToken } from "../auth/session-token.js";

export type InviteResolveStatus =
  | "pending"
  | "expired"
  | "revoked"
  | "accepted";

function toPublicUser(u: {
  id: string;
  email: string | null;
  name: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: "ADMIN" | "USER";
}): AuthMeResponse {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    displayName: u.displayName,
    avatarUrl: u.avatarUrl,
    role: u.role,
  };
}

export class InviteAcceptService {
  constructor(private readonly authService: AuthService) {}

  async resolveInvite(
    plainToken: string | undefined,
  ): Promise<
    | {
        ok: true;
        status: InviteResolveStatus;
        email: string;
        role: "ADMIN" | "USER";
        expiresAt: string;
      }
    | { ok: false; error: "invalid_token" }
  > {
    if (!plainToken?.trim()) {
      return { ok: false, error: "invalid_token" };
    }

    const tokenHash = hashSessionToken(plainToken.trim());
    const inv = await prisma.invite.findFirst({
      where: { tokenHash },
    });

    if (!inv) {
      return { ok: false, error: "invalid_token" };
    }

    const base = {
      email: inv.email,
      role: inv.role,
      expiresAt: inv.expiresAt.toISOString(),
    };

    if (inv.acceptedAt) {
      return { ok: true, status: "accepted", ...base };
    }
    if (inv.revokedAt) {
      return { ok: true, status: "revoked", ...base };
    }
    if (inv.expiresAt.getTime() <= Date.now()) {
      return { ok: true, status: "expired", ...base };
    }

    return { ok: true, status: "pending", ...base };
  }

  async acceptInvite(
    params: { plainToken: string; name: string; password: string },
    reply: FastifyReply,
  ): Promise<
    | { ok: true; user: AuthMeResponse }
    | {
        ok: false;
        error: "invalid_or_used_invite" | "email_taken" | "unique_violation";
      }
  > {
    const tokenHash = hashSessionToken(params.plainToken.trim());

    try {
      const result = await prisma.$transaction(async (tx) => {
        const inv = await tx.invite.findFirst({
          where: { tokenHash },
        });

        if (!inv) {
          return { type: "invalid" as const };
        }

        if (inv.acceptedAt || inv.revokedAt) {
          return { type: "invalid" as const };
        }
        if (inv.expiresAt.getTime() <= Date.now()) {
          return { type: "invalid" as const };
        }

        const email = inv.email;
        const existing = await tx.user.findFirst({
          where: { email },
        });
        if (existing) {
          return { type: "email_taken" as const };
        }

        const passwordHash = await bcrypt.hash(params.password, 10);

        const user = await tx.user.create({
          data: {
            email,
            name: params.name.trim(),
            passwordHash,
            role: inv.role,
            isActive: true,
          },
        });

        await tx.invite.update({
          where: { id: inv.id },
          data: { acceptedAt: new Date() },
        });

        return { type: "ok" as const, userId: user.id, user };
      });

      if (result.type === "invalid") {
        return { ok: false, error: "invalid_or_used_invite" };
      }
      if (result.type === "email_taken") {
        return { ok: false, error: "email_taken" };
      }

      await this.authService.establishSessionForUser(result.userId, reply);

      return {
        ok: true,
        user: toPublicUser(result.user),
      };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return { ok: false, error: "unique_violation" };
      }
      throw e;
    }
  }
}
