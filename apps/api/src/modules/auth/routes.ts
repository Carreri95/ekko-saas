import type { FastifyInstance } from "fastify";
import { env } from "../../infrastructure/config/env.js";
import { AuthService } from "./service.js";
import {
  authLoginBodySchema,
  authOpenAiKeyPutSchema,
  authPasswordChangeSchema,
  authProfilePatchSchema,
} from "./schemas.js";

export async function registerAuthRoutes(app: FastifyInstance): Promise<void> {
  const service = new AuthService();

  app.post("/api/auth/login", async (request, reply) => {
    const parsed = authLoginBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Dados invalidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await service.login(parsed.data.email, parsed.data.password, reply);

    if ("error" in result) {
      if (result.error === "invalid_credentials") {
        return reply.status(401).send({ error: "Credenciais invalidas" });
      }
      return reply.status(403).send({ error: "Conta desativada" });
    }

    return reply.send({ user: result.user });
  });

  app.post("/api/auth/logout", async (request, reply) => {
    const token = request.cookies[env.sessionCookieName];
    await service.logout(reply, token);
    return reply.send({ ok: true });
  });

  app.get("/api/auth/me", async (request, reply) => {
    const token = request.cookies[env.sessionCookieName];
    const result = await service.getMe(token);

    if ("error" in result) {
      if (result.error === "unauthorized") {
        return reply.status(401).send({ error: "Nao autenticado" });
      }
      return reply.status(403).send({ error: "Conta desativada" });
    }

    return reply.send({ user: result.user });
  });

  app.patch("/api/auth/profile", async (request, reply) => {
    const session = await service.resolveSessionUser(request);
    if (!session.ok) {
      if (session.error === "inactive") {
        return reply.status(403).send({ error: "Conta desativada" });
      }
      return reply.status(401).send({ error: "Nao autenticado" });
    }

    const parsed = authProfilePatchSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Dados invalidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const body = parsed.data;
    const result = await service.updateProfile(session.user.id, {
      name: body.name,
      displayName: body.displayName,
      avatarUrl:
        body.avatarUrl === undefined
          ? undefined
          : body.avatarUrl === null || body.avatarUrl === ""
            ? null
            : body.avatarUrl,
    });

    if (!result.ok) {
      return reply.status(404).send({ error: "Nao encontrado" });
    }

    return reply.send({ user: result.user });
  });

  app.patch("/api/auth/password", async (request, reply) => {
    const session = await service.resolveSessionUser(request);
    if (!session.ok) {
      if (session.error === "inactive") {
        return reply.status(403).send({ error: "Conta desativada" });
      }
      return reply.status(401).send({ error: "Nao autenticado" });
    }

    const parsed = authPasswordChangeSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Dados invalidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await service.changePassword(
      session.user.id,
      parsed.data.currentPassword,
      parsed.data.newPassword,
    );

    if (!result.ok) {
      if (result.error === "not_found") {
        return reply.status(404).send({ error: "Nao encontrado" });
      }
      if (result.error === "no_password") {
        return reply
          .status(400)
          .send({ error: "Conta sem senha definida; contacte o suporte" });
      }
      if (result.error === "invalid_current") {
        return reply.status(400).send({ error: "Senha atual incorreta" });
      }
      return reply.status(400).send({ error: "Nao foi possivel alterar a senha" });
    }

    return reply.send({ ok: true });
  });

  app.get("/api/auth/openai-key", async (request, reply) => {
    const session = await service.resolveSessionUser(request);
    if (!session.ok) {
      if (session.error === "inactive") {
        return reply.status(403).send({ error: "Conta desativada" });
      }
      return reply.status(401).send({ error: "Nao autenticado" });
    }
    const result = await service.getOpenAiKeyStatus(session.user.id);
    if (!result.ok) {
      return reply.status(404).send({ error: "Nao encontrado" });
    }
    return reply.send(result.status);
  });

  app.put("/api/auth/openai-key", async (request, reply) => {
    const session = await service.resolveSessionUser(request);
    if (!session.ok) {
      if (session.error === "inactive") {
        return reply.status(403).send({ error: "Conta desativada" });
      }
      return reply.status(401).send({ error: "Nao autenticado" });
    }
    const parsed = authOpenAiKeyPutSchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Dados invalidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }
    const result = await service.saveOpenAiKey(session.user.id, parsed.data.apiKey);
    if (!result.ok) {
      if (result.error === "not_found") {
        return reply.status(404).send({ error: "Nao encontrado" });
      }
      const status = result.error === "server_misconfigured" ? 500 : 400;
      return reply.status(status).send({ error: result.message });
    }
    return reply.send(result.status);
  });

  app.delete("/api/auth/openai-key", async (request, reply) => {
    const session = await service.resolveSessionUser(request);
    if (!session.ok) {
      if (session.error === "inactive") {
        return reply.status(403).send({ error: "Conta desativada" });
      }
      return reply.status(401).send({ error: "Nao autenticado" });
    }
    const result = await service.deleteOpenAiKey(session.user.id);
    if (!result.ok) {
      return reply.status(404).send({ error: "Nao encontrado" });
    }
    return reply.send(result.status);
  });
}
