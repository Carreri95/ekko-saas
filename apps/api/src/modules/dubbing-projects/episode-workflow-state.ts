import type { EpisodeStatus } from "../../generated/prisma/client.js";

/**
 * Estado operacional derivado (contrato API) — não persistido.
 * No web o tipo espelhado chama-se `DubbingEpisodeWorkflowState` (`app/types/dubbing-episode.ts`).
 */
export type EpisodeWorkflowState =
  | "sem_audio"
  | "audio_enviado"
  | "transcrevendo"
  | "pronto_para_editar"
  | "em_edicao"
  | "concluido";

/** Janela para tratar `updatedAt` recente como “em edição” (percepção UX). */
export const EPISODE_EDIT_RECENT_MS = 15 * 60 * 1000;

export type EpisodeWorkflowDeriveInput = {
  status: EpisodeStatus;
  audioFileId: string | null;
  subtitleFileId: string | null;
  transcriptionProjectId: string | null;
  editedAt: Date | null;
  updatedAt: Date;
  /** Injétavel em testes; fora disso usa `Date.now()`. */
  nowMs?: number;
};

/**
 * Ordem fixa (status sozinho não define `concluido` sem legenda):
 * 1. sem áudio
 * 2. transcrevendo: áudio + projeto de transcrição, sem legenda
 * 3. com legenda: DONE → concluido; senão em_edicao se editedAt ou updatedAt recente; senão pronto
 * 4. áudio sem legenda (sem vínculo de transcrição no passo 2): audio_enviado
 */
export function deriveEpisodeWorkflowState(
  e: EpisodeWorkflowDeriveInput,
): EpisodeWorkflowState {
  const now = e.nowMs ?? Date.now();

  if (!e.audioFileId) return "sem_audio";

  if (e.transcriptionProjectId && !e.subtitleFileId) {
    return "transcrevendo";
  }

  if (e.subtitleFileId) {
    if (e.status === "DONE") return "concluido";
    const editedRecently =
      e.editedAt != null ||
      now - e.updatedAt.getTime() < EPISODE_EDIT_RECENT_MS;
    if (editedRecently) return "em_edicao";
    return "pronto_para_editar";
  }

  return "audio_enviado";
}
