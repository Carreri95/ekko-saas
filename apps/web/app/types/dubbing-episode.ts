/** Resposta de GET /api/dubbing-projects/:id/episodes */
export type DubbingEpisodeStatus = "PENDING" | "TRANSCRIBING" | "DONE";

export type DubbingEpisodeDto = {
  id: string;
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
  number: number;
  title: string | null;
  status: DubbingEpisodeStatus;
  subtitleFileId: string | null;
  /** SubtitleFile do áudio enviado para transcrição (mesmo registo usado pelo job). */
  audioFileId: string | null;
  projectId: string;
};
