import type { CommunicationStatus } from "../../generated/prisma/client.js";
import type { CommunicationLogFull } from "./repository.js";
import { serializeCommunicationLog } from "./mapper.js";

const INFERRED_PREFIX = "inferred:";

export type CommunicationGroupConsolidatedStatus =
  | "PENDENTE"
  | "PROCESSANDO"
  | "ENVIADO_PARCIALMENTE"
  | "ENVIADO"
  | "FALHA_PARCIAL"
  | "FALHA";

export function computeConsolidatedStatus(statuses: CommunicationStatus[]): CommunicationGroupConsolidatedStatus {
  if (statuses.length === 0) return "PENDENTE";
  const anyProcessing = statuses.some((s) => s === "PROCESSING");
  const anySent = statuses.some((s) => s === "SENT");
  const anyFailed = statuses.some((s) => s === "FAILED");
  const anyPending = statuses.some((s) => s === "PENDING");
  const allSent = statuses.every((s) => s === "SENT");
  const allFailed = statuses.every((s) => s === "FAILED");

  if (allSent) return "ENVIADO";
  if (allFailed) return "FALHA";
  if (anyProcessing) return "PROCESSANDO";
  if (anySent && anyFailed) return "FALHA_PARCIAL";
  if (anySent && anyPending) return "ENVIADO_PARCIALMENTE";
  if (anyFailed) return "FALHA_PARCIAL";
  return "PENDENTE";
}

function byChannelOrder(a: CommunicationLogFull, b: CommunicationLogFull): number {
  const order = (ch: string) => (ch === "WHATSAPP" ? 0 : ch === "EMAIL" ? 1 : 2);
  return order(a.channel) - order(b.channel);
}

/**
 * Agrupa linhas persistidas (communicationGroupId) e, para dados antigos, emparelha EMAIL+WHATSAPP
 * com mesmo contexto criados quase ao mesmo tempo.
 */
export function buildCommunicationGroupBuckets(
  rows: CommunicationLogFull[],
): { groupId: string; rows: CommunicationLogFull[] }[] {
  const byGid = new Map<string, CommunicationLogFull[]>();
  const ungrouped: CommunicationLogFull[] = [];

  for (const r of rows) {
    if (r.communicationGroupId) {
      const arr = byGid.get(r.communicationGroupId) ?? [];
      arr.push(r);
      byGid.set(r.communicationGroupId, arr);
    } else {
      ungrouped.push(r);
    }
  }

  const groups: { groupId: string; rows: CommunicationLogFull[] }[] = [];
  for (const [gid, members] of byGid) {
    groups.push({
      groupId: gid,
      rows: [...members].sort(byChannelOrder),
    });
  }

  const pool = [...ungrouped];
  const used = new Set<string>();

  for (const e of pool) {
    if (used.has(e.id) || e.channel !== "EMAIL") continue;
    const match = pool.find(
      (w) =>
        !used.has(w.id) &&
        w.id !== e.id &&
        w.channel === "WHATSAPP" &&
        w.dubbingProjectId === e.dubbingProjectId &&
        e.sessionId != null &&
        e.sessionId === w.sessionId &&
        e.body === w.body &&
        (e.templateKey ?? "") === (w.templateKey ?? "") &&
        Math.abs(e.createdAt.getTime() - w.createdAt.getTime()) <= 5000,
    );
    if (match) {
      used.add(e.id);
      used.add(match.id);
      const a = e.id < match.id ? e.id : match.id;
      const b = e.id < match.id ? match.id : e.id;
      groups.push({
        groupId: `${INFERRED_PREFIX}${a}:${b}`,
        rows: [e, match].sort(byChannelOrder),
      });
    }
  }

  for (const r of pool) {
    if (used.has(r.id)) continue;
    groups.push({ groupId: r.id, rows: [r] });
  }

  groups.sort((ga, gb) => {
    const ta = Math.max(...ga.rows.map((x) => x.createdAt.getTime()));
    const tb = Math.max(...gb.rows.map((x) => x.createdAt.getTime()));
    return tb - ta;
  });

  return groups;
}

export function serializeCommunicationGroupListItem(
  groupId: string,
  members: CommunicationLogFull[],
): {
  groupId: string;
  consolidatedStatus: CommunicationGroupConsolidatedStatus;
  createdAt: string;
  direction: string;
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
  channels: string[];
  logs: ReturnType<typeof serializeCommunicationLog>[];
} {
  const sorted = [...members].sort(byChannelOrder);
  const head = sorted[0]!;
  const emailRow = sorted.find((r) => r.channel === "EMAIL");
  const waRow = sorted.find((r) => r.channel === "WHATSAPP");
  const statuses = sorted.map((r) => r.status);

  return {
    groupId,
    consolidatedStatus: computeConsolidatedStatus(statuses),
    createdAt: head.createdAt.toISOString(),
    direction: head.direction,
    subject: head.subject,
    body: head.body,
    templateKey: head.templateKey,
    recipientName: head.recipientName,
    recipientEmail: emailRow?.recipientEmail ?? null,
    recipientWhatsapp: waRow?.recipientWhatsapp ?? null,
    episodeId: head.episodeId,
    castMemberId: head.castMemberId,
    clientId: head.clientId,
    sessionId: head.sessionId,
    channels: sorted.map((r) => r.channel),
    logs: sorted.map(serializeCommunicationLog),
  };
}

export function parseInferredPairGroupId(groupId: string): [string, string] | null {
  if (!groupId.startsWith(INFERRED_PREFIX)) return null;
  const rest = groupId.slice(INFERRED_PREFIX.length);
  const parts = rest.split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return [parts[0], parts[1]];
}
