/** Resposta de GET/POST/PATCH `/api/dubbing-projects/:id/communication-logs` */

export type CommunicationChannel = "EMAIL" | "WHATSAPP" | "SYSTEM";
export type CommunicationDirection = "OUTBOUND" | "INBOUND";
export type CommunicationStatus =
  | "PENDING"
  | "PROCESSING"
  | "SENT"
  | "RECEIVED"
  | "FAILED";

export type CommunicationLogDto = {
  id: string;
  dubbingProjectId: string | null;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  status: CommunicationStatus;
  subject: string | null;
  body: string;
  templateKey: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  recipientWhatsapp: string | null;
  episodeId: string | null;
  castMemberId: string | null;
  clientId: string | null;
  sessionId: string | null;
  sentAt: string | null;
  error: string | null;
  providerMessageId?: string | null;
  /** Presente na API após PR 23; fallback 0 na UI se em falta. */
  sendAttemptCount?: number;
  lastSendAttemptAt?: string | null;
  nextRetryAt?: string | null;
  createdAt: string;
  updatedAt: string;
  project: { id: string; name: string } | null;
  episode: { id: string; number: number; title: string | null } | null;
  castMember: { id: string; name: string } | null;
  client: { id: string; name: string } | null;
  session: { id: string; title: string; startAt: string } | null;
};
