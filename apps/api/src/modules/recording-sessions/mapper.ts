import type {
  RecordingSessionFormat,
  RecordingSessionStatus,
} from "../../generated/prisma/client.js";
import type { RecordingSessionFull } from "./repository.js";

export type RecordingSessionRow = RecordingSessionFull;

function buildEpisodesList(row: RecordingSessionFull) {
  const fromJoin = row.sessionEpisodes.map((se) => ({
    id: se.episode.id,
    number: se.episode.number,
    title: se.episode.title,
  }));
  if (fromJoin.length > 0) return fromJoin;
  if (row.episode) {
    return [
      {
        id: row.episode.id,
        number: row.episode.number,
        title: row.episode.title,
      },
    ];
  }
  return [];
}

export function serializeRecordingSession(row: RecordingSessionFull) {
  const episodes = buildEpisodesList(row);
  const episodeId = episodes[0]?.id ?? row.episodeId ?? null;

  return {
    id: row.id,
    projectId: row.projectId,
    episodeId,
    episodes,
    characterId: row.characterId,
    castMemberId: row.castMemberId,
    recordingTechnicianId: row.recordingTechnicianId,
    title: row.title,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    status: row.status as RecordingSessionStatus,
    format: row.format as RecordingSessionFormat,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    castMember: row.castMember
      ? {
          id: row.castMember.id,
          name: row.castMember.name,
          role: row.castMember.role,
        }
      : null,
    recordingTechnician: row.recordingTechnician
      ? {
          id: row.recordingTechnician.id,
          name: row.recordingTechnician.name,
          role: row.recordingTechnician.role,
        }
      : null,
    episode:
      episodes[0] != null
        ? {
            id: episodes[0].id,
            number: episodes[0].number,
            title: episodes[0].title,
          }
        : null,
  };
}
