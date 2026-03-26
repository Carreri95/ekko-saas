export type DubbingProjectSerializeInput = {
  id: string;
  name: string;
  client: string | null;
  clientId: string | null;
  status: string;
  startDate: Date | null;
  deadline: Date | null;
  episodeCount: number | null;
  durationMin: number | null;
  language: string | null;
  value: { toString(): string } | number | null;
  paymentType: string;
  valueCurrency: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  userId: string | null;
};

export function serializeDubbingProject(p: DubbingProjectSerializeInput) {
  return {
    id: p.id,
    name: p.name,
    client: p.client,
    clientId: p.clientId,
    status: p.status,
    startDate: p.startDate?.toISOString() ?? null,
    deadline: p.deadline?.toISOString() ?? null,
    episodes: p.episodeCount,
    durationMin: p.durationMin,
    language: p.language,
    value: p.value != null ? p.value.toString() : null,
    valueCurrency: p.valueCurrency,
    paymentType: p.paymentType,
    notes: p.notes,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    userId: p.userId,
  };
}

export type CharacterRow = {
  id: string;
  projectId: string;
  name: string;
  type: string | null;
  voiceType: string | null;
  importance: "MAIN" | "SUPPORT" | "EXTRA";
  castMemberId: string | null;
  castMember: { id: string; name: string; role: string | null } | null;
  notes: string | null;
  createdAt: Date;
};

import type { EpisodeStatus } from "../../generated/prisma/client.js";
import {
  deriveEpisodeWorkflowState,
  type EpisodeWorkflowState,
} from "./episode-workflow-state.js";

export type { EpisodeWorkflowState };

export type EpisodeSerializeInput = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  editedAt: Date | null;
  number: number;
  title: string | null;
  status: EpisodeStatus;
  subtitleFileId: string | null;
  audioFileId: string | null;
  transcriptionProjectId: string | null;
  projectId: string;
};

export function serializeEpisode(e: EpisodeSerializeInput) {
  const workflowState = deriveEpisodeWorkflowState({
    status: e.status,
    audioFileId: e.audioFileId,
    subtitleFileId: e.subtitleFileId,
    transcriptionProjectId: e.transcriptionProjectId,
    editedAt: e.editedAt,
    updatedAt: e.updatedAt,
  });

  return {
    id: e.id,
    number: e.number,
    title: e.title,
    status: e.status,
    audioFileId: e.audioFileId,
    subtitleFileId: e.subtitleFileId,
    transcriptionProjectId: e.transcriptionProjectId,
    editedAt: e.editedAt?.toISOString() ?? null,
    updatedAt: e.updatedAt.toISOString(),
    workflowState,
    createdAt: e.createdAt.toISOString(),
    projectId: e.projectId,
  };
}

export function serializeProjectCharacter(c: CharacterRow) {
  return {
    id: c.id,
    projectId: c.projectId,
    name: c.name,
    type: c.type,
    voiceType: c.voiceType,
    importance: c.importance,
    castMemberId: c.castMemberId,
    castMember: c.castMember
      ? {
          id: c.castMember.id,
          name: c.castMember.name,
          role: c.castMember.role,
        }
      : null,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
  };
}
