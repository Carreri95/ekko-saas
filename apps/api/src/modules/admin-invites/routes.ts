import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AuthService } from "../auth/service.js";
import { createInviteBodySchema } from "./schemas.js";
import { AdminInviteService } from "./service.js";

async function ensureAdmin(
  authService: AuthService,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<{ adminUserId: string } | null> {
  const session = await authService.resolveSessionUser(request);
  if (!session.ok) {
    if (session.error === "inactive") {
      void reply.status(403).send({ error: "Conta desativada" });
      return null;
    }
    void reply.status(401).send({ error: "Nao autenticado" });
    return null;
  }
  if (session.user.role !== "ADMIN") {
    void reply.status(403).send({ error: "Acesso negado" });
    return null;
  }
  return { adminUserId: session.user.id };
}

export async function registerAdminInviteRoutes(app: FastifyInstance): Promise<void> {
  const authService = new AuthService();
  const invites = new AdminInviteService();

  app.post("/api/admin/invites", async (request, reply) => {
    const admin = await ensureAdmin(authService, request, reply);
    if (!admin) return;

    const parsed = createInviteBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Dados invalidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await invites.createInvite({
      adminUserId: admin.adminUserId,
      emailRaw: parsed.data.email,
    });

    if (!result.ok) {
      if (result.error === "email_registered") {
        return reply.status(409).send({
          error: "Este email já está registado",
        });
      }
      if (result.error === "pending_exists") {
        return reply.status(409).send({
          error: "Já existe um convite pendente para este email",
        });
      }
      return reply.status(409).send({
        error: "Conflito ao criar convite (email)",
      });
    }

    return reply.status(201).send({
      invite: result.invite,
      inviteUrl: result.inviteUrl,
    });
  });

  app.get("/api/admin/invites", async (request, reply) => {
    const admin = await ensureAdmin(authService, request, reply);
    if (!admin) return;

    const payload = await invites.listInvites();
    return reply.send(payload);
  });

  app.post("/api/admin/invites/:id/revoke", async (request, reply) => {
    const admin = await ensureAdmin(authService, request, reply);
    if (!admin) return;

    const id = (request.params as { id?: string }).id?.trim();
    if (!id) {
      return reply.status(400).send({ error: "id obrigatorio" });
    }

    const result = await invites.revokeInvite(id);

    if (!result.ok) {
      if (result.error === "not_found") {
        return reply.status(404).send({ error: "Nao encontrado" });
      }
      if (result.error === "already_accepted") {
        return reply.status(400).send({ error: "Convite já aceite" });
      }
      return reply.status(400).send({ error: "Convite já revogado" });
    }

    return reply.send({ ok: true });
  });
}
