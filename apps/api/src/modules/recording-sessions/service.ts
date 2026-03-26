import type { Prisma } from "../../generated/prisma/client.js";
import { serializeRecordingSession } from "./mapper.js";
import type { RecordingSessionCreateData, RecordingSessionPatchData } from "./schemas.js";
import { RecordingSessionsRepository } from "./repository.js";

function normalizeNotes(notes: string | null | undefined): string | null | undefined {
  if (notes === undefined) return undefined;
  if (notes === null) return null;
  const trimmed = String(notes).trim();
  return trimmed ? trimmed : null;
}

function parseIsoDate(value: string, fieldName: "startAt" | "endAt") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { badRequest: { error: `${fieldName} inválido` } as const };
  }
  return { date };
}

function normalizedEpisodeIdsCreate(input: RecordingSessionCreateData): string[] {
  if (input.episodeIds && input.episodeIds.length > 0) {
    return [...new Set(input.episodeIds)];
  }
  if (input.episodeId) return [input.episodeId];
  return [];
}

function normalizedEpisodeIdsPatch(input: RecordingSessionPatchData): string[] | undefined {
  if (input.episodeIds !== undefined) {
    return [...new Set(input.episodeIds)];
  }
  if (input.episodeId !== undefined) {
    return input.episodeId ? [input.episodeId] : [];
  }
  return undefined;
}

export class RecordingSessionsService {
  constructor(private readonly repo = new RecordingSessionsRepository()) {}

  async list(projectId: string) {
    const project = await this.repo.findProjectById(projectId);
    if (!project) return { notFound: true as const };
    const rows = await this.repo.listByProject(projectId);
    return { sessions: rows.map(serializeRecordingSession) };
  }

  async create(projectId: string, input: RecordingSessionCreateData) {
    const project = await this.repo.findProjectById(projectId);
    if (!project) return { notFound: true as const };

    const castMember = await this.repo.findCastMemberById(input.castMemberId);
    if (!castMember) return { badRequest: { error: "Dublador não encontrado" } as const };

    const episodeIds = normalizedEpisodeIdsCreate(input);
    for (const eid of episodeIds) {
      const episode = await this.repo.findEpisodeInProject(projectId, eid);
      if (!episode) return { badRequest: { error: "Episódio não pertence ao projeto" } as const };
    }

    if (input.characterId) {
      const character = await this.repo.findCharacterInProject(projectId, input.characterId);
      if (!character) return { badRequest: { error: "Personagem não pertence ao projeto" } as const };
    }

    const parsedStart = parseIsoDate(input.startAt, "startAt");
    if ("badRequest" in parsedStart) return parsedStart;
    const parsedEnd = parseIsoDate(input.endAt, "endAt");
    if ("badRequest" in parsedEnd) return parsedEnd;
    if (parsedStart.date >= parsedEnd.date) {
      return { badRequest: { error: "startAt deve ser menor que endAt" } as const };
    }

    const created = await this.repo.createWithEpisodes(
      {
        projectId,
        castMemberId: input.castMemberId,
        characterId: input.characterId ?? null,
        title: input.title.trim(),
        startAt: parsedStart.date,
        endAt: parsedEnd.date,
        status: input.status,
        format: input.format,
        notes: normalizeNotes(input.notes) ?? null,
      },
      episodeIds,
    );
    return { session: serializeRecordingSession(created) };
  }

  async patch(projectId: string, sessionId: string, input: RecordingSessionPatchData) {
    const existing = await this.repo.findInProject(projectId, sessionId);
    if (!existing) return { notFound: true as const };

    if (input.castMemberId !== undefined) {
      const castMember = await this.repo.findCastMemberById(input.castMemberId);
      if (!castMember) return { badRequest: { error: "Dublador não encontrado" } as const };
    }

    const replaceEpisodeIds = normalizedEpisodeIdsPatch(input);
    if (replaceEpisodeIds !== undefined) {
      for (const eid of replaceEpisodeIds) {
        const episode = await this.repo.findEpisodeInProject(projectId, eid);
        if (!episode) return { badRequest: { error: "Episódio não pertence ao projeto" } as const };
      }
    }

    if (input.characterId !== undefined && input.characterId !== null) {
      const character = await this.repo.findCharacterInProject(projectId, input.characterId);
      if (!character) return { badRequest: { error: "Personagem não pertence ao projeto" } as const };
    }

    const nextStartRaw = input.startAt ?? existing.startAt.toISOString();
    const nextEndRaw = input.endAt ?? existing.endAt.toISOString();
    const parsedStart = parseIsoDate(nextStartRaw, "startAt");
    if ("badRequest" in parsedStart) return parsedStart;
    const parsedEnd = parseIsoDate(nextEndRaw, "endAt");
    if ("badRequest" in parsedEnd) return parsedEnd;
    if (parsedStart.date >= parsedEnd.date) {
      return { badRequest: { error: "startAt deve ser menor que endAt" } as const };
    }

    const data: Prisma.RecordingSessionUncheckedUpdateInput = {};
    if (input.castMemberId !== undefined) data.castMemberId = input.castMemberId;
    if (input.characterId !== undefined) data.characterId = input.characterId;
    if (input.title !== undefined) data.title = input.title.trim();
    if (input.startAt !== undefined) data.startAt = parsedStart.date;
    if (input.endAt !== undefined) data.endAt = parsedEnd.date;
    if (input.status !== undefined) data.status = input.status;
    if (input.format !== undefined) data.format = input.format;
    if (input.notes !== undefined) data.notes = normalizeNotes(input.notes);

    const updated = await this.repo.update(sessionId, data, {
      replaceEpisodeIds,
    });
    return { session: serializeRecordingSession(updated) };
  }

  async remove(projectId: string, sessionId: string) {
    const existing = await this.repo.findInProject(projectId, sessionId);
    if (!existing) return { notFound: true as const };
    await this.repo.delete(sessionId);
    return { ok: true as const };
  }
}
