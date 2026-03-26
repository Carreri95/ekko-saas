import type { FastifyInstance } from "fastify";
import { AuthService } from "../auth/service.js";
import { storeUserAvatar } from "./avatar-upload.service.js";

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  const authService = new AuthService();

  app.post("/api/users/avatar", async (request, reply) => {
    const session = await authService.resolveSessionUser(request);
    if (!session.ok) {
      if (session.error === "inactive") {
        return reply.status(403).send({ error: "Conta desativada" });
      }
      return reply.status(401).send({ error: "Nao autenticado" });
    }

    if (!request.isMultipart()) {
      return reply.status(400).send({ error: "multipart invalido" });
    }

    let file;
    try {
      file = await request.file();
    } catch {
      return reply.status(400).send({ error: "multipart invalido" });
    }

    if (!file || file.fieldname !== "avatar") {
      return reply.status(400).send({ error: "Campo avatar e obrigatorio" });
    }

    const buffer = await file.toBuffer();
    const mimeType = file.mimetype || "application/octet-stream";

    const stored = await storeUserAvatar({
      userId: session.user.id,
      buffer,
      mimeType,
    });

    if (!stored.ok) {
      return reply.status(400).send({ error: stored.error });
    }

    const updated = await authService.updateProfile(session.user.id, {
      avatarUrl: stored.avatarUrl,
    });

    if (!updated.ok) {
      return reply.status(404).send({ error: "Nao encontrado" });
    }

    return reply.send({ user: updated.user });
  });
}
