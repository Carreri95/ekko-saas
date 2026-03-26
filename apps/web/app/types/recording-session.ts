export type RecordingSessionStatus =
  | "PENDING"
  | "CONFIRMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELED";

export type RecordingSessionFormat = "REMOTE" | "IN_PERSON";

export type RecordingSessionEpisodeRef = {
  id: string;
  number?: number;
  title?: string | null;
};

export type RecordingSessionDto = {
  id: string;
  projectId: string;
  episodeId: string | null;
  /** Episódios ligados à sessão (N:N). */
  episodes?: RecordingSessionEpisodeRef[];
  characterId: string | null;
  castMemberId: string;
  title: string;
  startAt: string;
  endAt: string;
  status: RecordingSessionStatus;
  format: RecordingSessionFormat;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  castMember: {
    id: string;
    name: string;
    role: string | null;
  } | null;
  episode?: {
    id: string;
    number?: number;
    title?: string | null;
  } | null;
  character?: {
    id: string;
    name?: string;
  } | null;
};
