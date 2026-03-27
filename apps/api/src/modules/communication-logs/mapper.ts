import type {
  CommunicationChannel,
  CommunicationDirection,
  CommunicationStatus,
} from "../../generated/prisma/client.js";
import type { CommunicationLogFull } from "./repository.js";

export function serializeCommunicationLog(row: CommunicationLogFull) {
  return {
    id: row.id,
    dubbingProjectId: row.dubbingProjectId,
    channel: row.channel as CommunicationChannel,
    direction: row.direction as CommunicationDirection,
    status: row.status as CommunicationStatus,
    subject: row.subject,
    body: row.body,
    templateKey: row.templateKey,
    recipientName: row.recipientName,
    recipientEmail: row.recipientEmail,
    recipientWhatsapp: row.recipientWhatsapp,
    episodeId: row.episodeId,
    castMemberId: row.castMemberId,
    clientId: row.clientId,
    sessionId: row.sessionId,
    sentAt: row.sentAt ? row.sentAt.toISOString() : null,
    error: row.error,
    providerMessageId: row.providerMessageId,
    sendAttemptCount: row.sendAttemptCount,
    lastSendAttemptAt: row.lastSendAttemptAt
      ? row.lastSendAttemptAt.toISOString()
      : null,
    nextRetryAt: row.nextRetryAt ? row.nextRetryAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    project: row.dubbingProject
      ? { id: row.dubbingProject.id, name: row.dubbingProject.name }
      : null,
    episode: row.episode
      ? {
          id: row.episode.id,
          number: row.episode.number,
          title: row.episode.title,
        }
      : null,
    castMember: row.castMember
      ? { id: row.castMember.id, name: row.castMember.name }
      : null,
    client: row.client ? { id: row.client.id, name: row.client.name } : null,
    session: row.session
      ? {
          id: row.session.id,
          title: row.session.title,
          startAt: row.session.startAt.toISOString(),
        }
      : null,
  };
}
