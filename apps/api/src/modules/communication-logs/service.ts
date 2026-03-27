import type { Prisma } from "../../generated/prisma/client.js";
import { env } from "../../infrastructure/config/env.js";
import { serializeCommunicationLog } from "./mapper.js";
import type { CommunicationLogCreateData, CommunicationLogPatchData } from "./schemas.js";
import { CommunicationLogsRepository } from "./repository.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WHATSAPP_RE = /^\+?[1-9]\d{7,19}$/;

function normalizeOptionalString(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const t = String(value).trim();
  return t ? t : null;
}

export class CommunicationLogsService {
  constructor(private readonly repo = new CommunicationLogsRepository()) {}

  async list(projectId: string) {
    const project = await this.repo.findProjectById(projectId);
    if (!project) return { notFound: true as const };
    const rows = await this.repo.listByProject(projectId);
    return { logs: rows.map(serializeCommunicationLog) };
  }

  private async validateOptionalLinks(
    projectId: string,
    input: {
      episodeId?: string | null;
      sessionId?: string | null;
      castMemberId?: string | null;
      clientId?: string | null;
    },
  ): Promise<{ ok: true } | { badRequest: { error: string } }> {
    if (input.episodeId) {
      const ep = await this.repo.findEpisodeInProject(projectId, input.episodeId);
      if (!ep) return { badRequest: { error: "Episódio não pertence ao projeto" } };
    }
    if (input.sessionId) {
      const s = await this.repo.findSessionInProject(projectId, input.sessionId);
      if (!s) return { badRequest: { error: "Sessão não pertence ao projeto" } };
    }
    if (input.castMemberId) {
      const m = await this.repo.findCastMemberById(input.castMemberId);
      if (!m) return { badRequest: { error: "Dublador não encontrado" } };
    }
    if (input.clientId) {
      const c = await this.repo.findClientById(input.clientId);
      if (!c) return { badRequest: { error: "Cliente não encontrado" } };
    }
    return { ok: true };
  }

  async create(projectId: string, input: CommunicationLogCreateData) {
    const project = await this.repo.findProjectById(projectId);
    if (!project) return { notFound: true as const };

    if (input.status === "PROCESSING") {
      return {
        badRequest: {
          error: "O estado PROCESSING só é definido pelo pedido de envio (POST .../send).",
        } as const,
      };
    }

    const links = await this.validateOptionalLinks(projectId, {
      episodeId: input.episodeId,
      sessionId: input.sessionId,
      castMemberId: input.castMemberId,
      clientId: input.clientId,
    });
    if ("badRequest" in links) return links;

    const sentAt =
      input.sentAt === undefined
        ? undefined
        : input.sentAt === null
          ? null
          : new Date(input.sentAt);

    if (sentAt !== undefined && sentAt !== null && Number.isNaN(sentAt.getTime())) {
      return { badRequest: { error: "sentAt inválido" } as const };
    }

    const data: Prisma.CommunicationLogUncheckedCreateInput = {
      dubbingProjectId: projectId,
      channel: input.channel,
      direction: input.direction,
      status: input.status,
      body: input.body,
      subject: normalizeOptionalString(input.subject) ?? null,
      templateKey: normalizeOptionalString(input.templateKey) ?? null,
      recipientName: normalizeOptionalString(input.recipientName) ?? null,
      recipientEmail: normalizeOptionalString(input.recipientEmail) ?? null,
      recipientWhatsapp: normalizeOptionalString(input.recipientWhatsapp) ?? null,
      episodeId: input.episodeId ?? null,
      castMemberId: input.castMemberId ?? null,
      clientId: input.clientId ?? null,
      sessionId: input.sessionId ?? null,
      sentAt: sentAt ?? null,
      error: normalizeOptionalString(input.error) ?? null,
    };

    const created = await this.repo.create(data);
    return { log: serializeCommunicationLog(created) };
  }

  async patch(projectId: string, logId: string, input: CommunicationLogPatchData) {
    const existing = await this.repo.findInProject(projectId, logId);
    if (!existing) return { notFound: true as const };

    if (input.status === "PROCESSING") {
      return {
        badRequest: {
          error: "O estado PROCESSING só é definido pelo pedido de envio (POST .../send).",
        } as const,
      };
    }

    const nextEpisodeId = input.episodeId !== undefined ? input.episodeId : existing.episodeId;
    const nextSessionId = input.sessionId !== undefined ? input.sessionId : existing.sessionId;
    const nextCastMemberId =
      input.castMemberId !== undefined ? input.castMemberId : existing.castMemberId;
    const nextClientId = input.clientId !== undefined ? input.clientId : existing.clientId;

    const links = await this.validateOptionalLinks(projectId, {
      episodeId: nextEpisodeId,
      sessionId: nextSessionId,
      castMemberId: nextCastMemberId,
      clientId: nextClientId,
    });
    if ("badRequest" in links) return links;

    const data: Prisma.CommunicationLogUncheckedUpdateInput = {};

    if (input.channel !== undefined) data.channel = input.channel;
    if (input.direction !== undefined) data.direction = input.direction;
    if (input.status !== undefined) data.status = input.status;
    if (input.body !== undefined) data.body = input.body;
    if (input.subject !== undefined) data.subject = normalizeOptionalString(input.subject) ?? null;
    if (input.templateKey !== undefined)
      data.templateKey = normalizeOptionalString(input.templateKey) ?? null;
    if (input.recipientName !== undefined)
      data.recipientName = normalizeOptionalString(input.recipientName) ?? null;
    if (input.recipientEmail !== undefined)
      data.recipientEmail = normalizeOptionalString(input.recipientEmail) ?? null;
    if (input.recipientWhatsapp !== undefined)
      data.recipientWhatsapp = normalizeOptionalString(input.recipientWhatsapp) ?? null;
    if (input.episodeId !== undefined) data.episodeId = input.episodeId;
    if (input.castMemberId !== undefined) data.castMemberId = input.castMemberId;
    if (input.clientId !== undefined) data.clientId = input.clientId;
    if (input.sessionId !== undefined) data.sessionId = input.sessionId;

    if (input.sentAt !== undefined) {
      if (input.sentAt === null) {
        data.sentAt = null;
      } else {
        const d = new Date(input.sentAt);
        if (Number.isNaN(d.getTime())) {
          return { badRequest: { error: "sentAt inválido" } as const };
        }
        data.sentAt = d;
      }
    }

    if (input.error !== undefined) data.error = normalizeOptionalString(input.error) ?? null;

    const updated = await this.repo.update(logId, data);
    return { log: serializeCommunicationLog(updated) };
  }

  async remove(projectId: string, logId: string) {
    const existing = await this.repo.findInProject(projectId, logId);
    if (!existing) return { notFound: true as const };
    await this.repo.delete(logId);
    return { ok: true as const };
  }

  /**
   * Enfileira envio real (worker + provider por canal). O pedido HTTP não chama o provider.
   */
  async enqueueSend(projectId: string, logId: string) {
    const existing = await this.repo.findInProject(projectId, logId);
    if (!existing) return { notFound: true as const };

    if (existing.channel !== "EMAIL" && existing.channel !== "WHATSAPP") {
      return {
        badRequest: {
          error: "Envio real só está disponível para canais EMAIL ou WHATSAPP",
        } as const,
      };
    }

    if (existing.direction !== "OUTBOUND") {
      return {
        badRequest: {
          error:
            "Apenas comunicações de saída (OUTBOUND) podem ser enviadas por EMAIL ou WHATSAPP",
        } as const,
      };
    }

    if (existing.status === "SENT") {
      return { badRequest: { error: "Este registo já foi enviado com sucesso" } as const };
    }
    if (existing.providerMessageId) {
      return {
        badRequest: {
          error:
            "Este registo já possui confirmação de envio no provider; não pode ser reenfileirado por esta acção.",
        } as const,
      };
    }

    if (existing.status === "RECEIVED") {
      return { badRequest: { error: "Registos INBOUND recebidos não são reenviados por esta acção" } as const };
    }

    if (existing.status === "PROCESSING") {
      return {
        conflict: {
          error: "Este registo já está na fila ou a ser processado para envio",
        } as const,
      };
    }

    const body = existing.body.trim();
    if (!body) {
      return { badRequest: { error: "O corpo da mensagem não pode estar vazio" } as const };
    }

    if (existing.channel === "EMAIL") {
      const email = existing.recipientEmail?.trim() ?? "";
      if (!email) {
        return {
          badRequest: { error: "Indique o e-mail do destinatário antes de enviar" } as const,
        };
      }
      if (!EMAIL_RE.test(email)) {
        return { badRequest: { error: "E-mail do destinatário inválido" } as const };
      }
      if (!env.resendApiKey) {
        return {
          badRequest: {
            error:
              "Envio de e-mail não configurado no servidor (defina RESEND_API_KEY na API e no worker)",
          } as const,
        };
      }
    } else {
      const whatsappRaw = existing.recipientWhatsapp?.trim() ?? "";
      if (!whatsappRaw) {
        return {
          badRequest: {
            error: "Indique o WhatsApp do destinatário antes de enviar",
          } as const,
        };
      }
      const normalized = whatsappRaw.replace(/[^\d+]/g, "");
      if (!WHATSAPP_RE.test(normalized)) {
        return { badRequest: { error: "WhatsApp do destinatário inválido" } as const };
      }
      if (!env.evolutionApiUrl || !env.evolutionApiKey || !env.evolutionInstanceName) {
        return {
          badRequest: {
            error:
              "Envio por WhatsApp não configurado no servidor (defina EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE_NAME na API e no worker)",
          } as const,
        };
      }
    }

    const updated = await this.repo.update(logId, {
      status: "PROCESSING",
      sentAt: null,
      error: null,
      providerMessageId: null,
      sendLockedAt: null,
      sendAttemptCount: 0,
      lastSendAttemptAt: null,
      nextRetryAt: null,
    });

    return {
      queued: true as const,
      accepted: true as const,
      log: serializeCommunicationLog(updated),
    };
  }
}
