/** Resposta de GET /api/dubbing-projects/:id/episodes e GET .../episodes/:epId */
export type DubbingEpisodeStatus = "PENDING" | "TRANSCRIBING" | "DONE";

/**
 * Espelha o union `EpisodeWorkflowState` da API (`apps/api/.../episode-workflow-state.ts`).
 * Nome com prefixo Dubbing* por contexto de domínio no frontend.
 */
export type DubbingEpisodeWorkflowState =
  | "sem_audio"
  | "audio_enviado"
  | "transcrevendo"
  | "pronto_para_editar"
  | "em_edicao"
  | "concluido";

export type DubbingEpisodeDto = {
  id: string;
  number: number;
  title: string | null;
  status: DubbingEpisodeStatus;
  audioFileId: string | null;
  subtitleFileId: string | null;
  transcriptionProjectId: string | null;
  editedAt: string | null;
  updatedAt: string;
  workflowState: DubbingEpisodeWorkflowState;
  createdAt: string;
  projectId: string;
};
