import type { FastifyInstance } from "fastify";
import { AuthService } from "../auth/service.js";
import { acceptInviteBodySchema } from "./schemas.js";
import { InviteAcceptService } from "./service.js";

export async function registerInviteAcceptRoutes(app: FastifyInstance): Promise<void> {
  const authService = new AuthService();
  const service = new InviteAcceptService(authService);

  app.get("/api/invites/resolve", async (request, reply) => {
    const url = new URL(request.url, "http://localhost");
    const token = url.searchParams.get("token") ?? undefined;

    const result = await service.resolveInvite(token);

    if (!result.ok) {
      return reply.status(404).send({ error: "Convite invalido ou expirado" });
    }

    return reply.send({
      status: result.status,
      email: result.email,
      role: result.role,
      expiresAt: result.expiresAt,
    });
  });

  app.post("/api/invites/accept", async (request, reply) => {
    const parsed = acceptInviteBodySchema.safeParse(request.body ?? {});
    if (!parsed.success) {
      return reply.status(400).send({
        error: "Dados invalidos",
        details: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await service.acceptInvite(
      {
        plainToken: parsed.data.token,
        name: parsed.data.name,
        password: parsed.data.password,
      },
      reply,
    );

    if (!result.ok) {
      if (result.error === "invalid_or_used_invite") {
        return reply.status(400).send({
          error: "Convite invalido, expirado ou já utilizado",
        });
      }
      if (result.error === "email_taken") {
        return reply.status(409).send({
          error: "Este email já está registado",
        });
      }
      return reply.status(409).send({
        error: "Não foi possível concluir o registo",
      });
    }

    return reply.status(201).send({ user: result.user });
  });
}
