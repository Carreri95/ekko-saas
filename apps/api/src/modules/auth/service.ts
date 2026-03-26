import bcrypt from "bcryptjs";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { AuthMeResponse } from "@subtitlebot/shared";
import { prisma } from "../../infrastructure/db/prisma.client.js";
import { env } from "../../infrastructure/config/env.js";
import { generateSessionToken, hashSessionToken } from "./session-token.js";
import { encryptOpenAiKey, maskOpenAiKey } from "./openai-key-crypto.js";

function normOptionalString(
  v: string | null | undefined,
): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  const t = v.trim();
  return t === "" ? null : t.slice(0, 200);
}

function toPublicUser(user: {
  id: string;
  email: string | null;
  name: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: "ADMIN" | "USER";
}): AuthMeResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    role: user.role,
  };
}

export type SessionUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: "ADMIN" | "USER";
  isActive: boolean;
};

export type OpenAiKeyStatus = {
  hasKey: boolean;
  masked: string | null;
};

export class AuthService {
  private ensureOpenAiEncryptionReady(): { ok: true } | { ok: false; error: string } {
    if (!env.openAiKeyEncryptionSecret) {
      return {
        ok: false,
        error:
          "OPENAI_KEY_ENCRYPTION_SECRET não configurada no servidor. Contacte o administrador.",
      };
    }
    return { ok: true };
  }
  /**
   * Resolve utilizador a partir do cookie de sessão (mesma lógica que GET /api/auth/me).
   */
  async resolveSessionUser(request: FastifyRequest): Promise<
    | { ok: true; user: SessionUser }
    | { ok: false; error: "unauthorized" | "inactive" }
  > {
    const token = request.cookies[env.sessionCookieName];
    if (!token) {
      return { ok: false, error: "unauthorized" };
    }

    const tokenHash = hashSessionToken(token);
    const now = new Date();

    const session = await prisma.session.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: now },
      },
      include: {
        user: true,
      },
    });

    if (!session) {
      return { ok: false, error: "unauthorized" };
    }

    const { user } = session;
    if (!user.isActive) {
      return { ok: false, error: "inactive" };
    }

    return {
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
      },
    };
  }

  async login(
    emailRaw: string,
    password: string,
    reply: FastifyReply,
  ): Promise<
    | { ok: true; user: AuthMeResponse }
    | { error: "invalid_credentials" }
    | { error: "inactive" }
  > {
    const email = emailRaw.trim().toLowerCase();

    const user = await prisma.user.findFirst({
      where: { email },
    });

    if (!user?.passwordHash) {
      return { error: "invalid_credentials" };
    }

    if (!user.isActive) {
      return { error: "inactive" };
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return { error: "invalid_credentials" };
    }

    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + env.sessionMaxAgeSec * 1000);

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    reply.setCookie(env.sessionCookieName, token, {
      path: "/",
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: "lax",
      maxAge: env.sessionMaxAgeSec,
    });

    return { ok: true, user: toPublicUser(user) };
  }

  /**
   * Cria sessão em BD + cookie httpOnly (mesmo contrato que login).
   * Usado após aceite de convite para autenticar o novo utilizador.
   */
  async establishSessionForUser(userId: string, reply: FastifyReply): Promise<void> {
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const expiresAt = new Date(Date.now() + env.sessionMaxAgeSec * 1000);

    await prisma.session.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    reply.setCookie(env.sessionCookieName, token, {
      path: "/",
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: "lax",
      maxAge: env.sessionMaxAgeSec,
    });
  }

  async logout(reply: FastifyReply, sessionToken: string | undefined): Promise<void> {
    if (sessionToken) {
      const tokenHash = hashSessionToken(sessionToken);
      await prisma.session.deleteMany({
        where: { tokenHash },
      });
    }

    reply.clearCookie(env.sessionCookieName, {
      path: "/",
      httpOnly: true,
      secure: env.cookieSecure,
      sameSite: "lax",
    });
  }

  async getMe(sessionToken: string | undefined): Promise<
    | { ok: true; user: AuthMeResponse }
    | { error: "unauthorized" }
    | { error: "inactive" }
  > {
    if (!sessionToken) {
      return { error: "unauthorized" };
    }

    const tokenHash = hashSessionToken(sessionToken);
    const now = new Date();

    const session = await prisma.session.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: now },
      },
      include: {
        user: true,
      },
    });

    if (!session) {
      return { error: "unauthorized" };
    }

    const { user } = session;
    if (!user.isActive) {
      return { error: "inactive" };
    }

    return { ok: true, user: toPublicUser(user) };
  }

  async updateProfile(
    userId: string,
    data: {
      name?: string | null;
      displayName?: string | null;
      avatarUrl?: string | null;
    },
  ): Promise<{ ok: true; user: AuthMeResponse } | { ok: false; error: "not_found" }> {
    const existing = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!existing) {
      return { ok: false, error: "not_found" };
    }

    const nameVal = normOptionalString(data.name);
    const displayNameVal = normOptionalString(data.displayName);
    const avatarUrlVal =
      data.avatarUrl === undefined
        ? undefined
        : data.avatarUrl === null
          ? null
          : data.avatarUrl.trim().slice(0, 2000);

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(nameVal !== undefined && { name: nameVal }),
        ...(displayNameVal !== undefined && { displayName: displayNameVal }),
        ...(avatarUrlVal !== undefined && { avatarUrl: avatarUrlVal }),
      },
    });

    return { ok: true, user: toPublicUser(updated) };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<
    | { ok: true }
    | { ok: false; error: "not_found" | "invalid_current" | "no_password" }
  > {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      return { ok: false, error: "not_found" };
    }
    if (!user.passwordHash) {
      return { ok: false, error: "no_password" };
    }

    const match = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!match) {
      return { ok: false, error: "invalid_current" };
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    return { ok: true };
  }

  async getOpenAiKeyStatus(
    userId: string,
  ): Promise<{ ok: true; status: OpenAiKeyStatus } | { ok: false; error: "not_found" }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        openAiWhisperKeyEncrypted: true,
        openAiWhisperKeyMask: true,
      },
    });
    if (!user) {
      return { ok: false, error: "not_found" };
    }
    return {
      ok: true,
      status: {
        hasKey: Boolean(user.openAiWhisperKeyEncrypted),
        masked: user.openAiWhisperKeyMask ?? null,
      },
    };
  }

  async saveOpenAiKey(
    userId: string,
    rawKey: string,
  ): Promise<
    | { ok: true; status: OpenAiKeyStatus }
    | { ok: false; error: "not_found" | "server_misconfigured" | "invalid_key"; message: string }
  > {
    const ready = this.ensureOpenAiEncryptionReady();
    if (!ready.ok) {
      return { ok: false, error: "server_misconfigured", message: ready.error };
    }
    const key = rawKey.trim();
    if (key.length < 20) {
      return { ok: false, error: "invalid_key", message: "Chave OpenAI inválida." };
    }
    const encrypted = encryptOpenAiKey(key, env.openAiKeyEncryptionSecret);
    const masked = maskOpenAiKey(key);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return { ok: false, error: "not_found", message: "Utilizador não encontrado." };
    }
    await prisma.user.update({
      where: { id: userId },
      data: {
        openAiWhisperKeyEncrypted: encrypted,
        openAiWhisperKeyMask: masked,
      },
    });
    return { ok: true, status: { hasKey: true, masked } };
  }

  async deleteOpenAiKey(
    userId: string,
  ): Promise<{ ok: true; status: OpenAiKeyStatus } | { ok: false; error: "not_found" }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      return { ok: false, error: "not_found" };
    }
    await prisma.user.update({
      where: { id: userId },
      data: {
        openAiWhisperKeyEncrypted: null,
        openAiWhisperKeyMask: null,
      },
    });
    return { ok: true, status: { hasKey: false, masked: null } };
  }
}
