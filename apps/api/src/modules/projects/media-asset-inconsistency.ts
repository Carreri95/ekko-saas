import { prisma } from "../../infrastructure/db/prisma.client.js";
import { findLatestSubtitleFileForProject } from "./subtitle-file-queries.js";
import {
  findCurrentMediaAssetCandidates,
  pickCurrentMediaAssetFromCandidates,
  resolveCurrentMediaAsset,
} from "./media-asset-current.js";

/** Caminho esperado para `wavPath` quando `publicPath` = `/uploads/media/{storageKey}`. */
export function expectedWavPathForStorageKey(storageKey: string): string {
  return `/uploads/media/${storageKey}`;
}

export type ProjectWithoutCurrentAsset = {
  projectId: string;
  storageKey: string;
};

/**
 * Project com `storageKey` mas sem nenhum `MediaAsset` que satisfaça a regra corrente.
 */
export async function findProjectsWithStorageKeyButNoCurrentAsset(): Promise<
  ProjectWithoutCurrentAsset[]
> {
  const projects = await prisma.project.findMany({
    where: { storageKey: { not: null } },
    select: { id: true, storageKey: true },
  });
  const out: ProjectWithoutCurrentAsset[] = [];
  for (const p of projects) {
    const sk = p.storageKey!;
    const cur = await resolveCurrentMediaAsset(p.id, sk);
    if (!cur) {
      out.push({ projectId: p.id, storageKey: sk });
    }
  }
  return out;
}

export type WavPathDivergence = {
  projectId: string;
  subtitleFileId: string;
  storageKey: string;
  expectedWavPath: string;
  actualWavPath: string | null;
};

/**
 * `SubtitleFile.wavPath` (secundário) ≠ `/uploads/media/{Project.storageKey}`.
 */
export async function findWavPathDivergencesFromProjectStorageKey(): Promise<WavPathDivergence[]> {
  const projects = await prisma.project.findMany({
    where: { storageKey: { not: null } },
    select: { id: true, storageKey: true },
  });
  const out: WavPathDivergence[] = [];
  for (const p of projects) {
    const sk = p.storageKey!;
    const expected = expectedWavPathForStorageKey(sk);
    const sf = await findLatestSubtitleFileForProject(prisma, p.id);
    if (!sf) continue;
    const actual = (sf.wavPath ?? "").trim();
    if (actual !== expected) {
      out.push({
        projectId: p.id,
        subtitleFileId: sf.id,
        storageKey: sk,
        expectedWavPath: expected,
        actualWavPath: sf.wavPath ?? null,
      });
    }
  }
  return out;
}

export type WrongSubtitleFileLink = {
  mediaAssetId: string;
  subtitleFileId: string;
  projectId: string;
  reason: string;
};

/**
 * `MediaAsset` com `subtitleFileId` que não é o asset corrente (ou o vínculo é incoerente com o ativo).
 */
export async function findMediaAssetsWithWrongSubtitleFileLink(): Promise<WrongSubtitleFileLink[]> {
  const withFk = await prisma.mediaAsset.findMany({
    where: { subtitleFileId: { not: null } },
    select: {
      id: true,
      subtitleFileId: true,
      subtitleFile: {
        select: { id: true, projectId: true },
      },
    },
  });

  const out: WrongSubtitleFileLink[] = [];

  for (const ma of withFk) {
    const sf = ma.subtitleFile;
    if (!sf || !ma.subtitleFileId) continue;

    const project = await prisma.project.findUnique({
      where: { id: sf.projectId },
      select: { id: true, storageKey: true },
    });
    if (!project?.storageKey) {
      out.push({
        mediaAssetId: ma.id,
        subtitleFileId: ma.subtitleFileId,
        projectId: sf.projectId,
        reason: "project_sem_storageKey",
      });
      continue;
    }

    const active = await findLatestSubtitleFileForProject(prisma, project.id);
    if (!active) {
      out.push({
        mediaAssetId: ma.id,
        subtitleFileId: ma.subtitleFileId,
        projectId: project.id,
        reason: "sem_subtitle_file_ativo",
      });
      continue;
    }

    if (ma.subtitleFileId !== active.id) {
      out.push({
        mediaAssetId: ma.id,
        subtitleFileId: ma.subtitleFileId,
        projectId: project.id,
        reason: "subtitleFileId_nao_e_o_ativo_atual",
      });
      continue;
    }

    const current = await resolveCurrentMediaAsset(project.id, project.storageKey);
    if (!current && ma.subtitleFileId === active.id) {
      out.push({
        mediaAssetId: ma.id,
        subtitleFileId: ma.subtitleFileId,
        projectId: project.id,
        reason: "sem_asset_corrente_mas_fk_para_subtitle_ativo",
      });
      continue;
    }
    if (current && current.id !== ma.id) {
      out.push({
        mediaAssetId: ma.id,
        subtitleFileId: ma.subtitleFileId,
        projectId: project.id,
        reason: "asset_nao_corrente_mas_ligado_ao_ativo",
      });
    }
  }

  return out;
}

export type MultipleCurrentCandidates = {
  projectId: string;
  storageKey: string;
  candidateIds: string[];
  chosenId: string;
};

/**
 * Mais do que um candidato para asset corrente (anomalia).
 */
export async function findMultipleCurrentCandidates(): Promise<MultipleCurrentCandidates[]> {
  const projects = await prisma.project.findMany({
    where: { storageKey: { not: null } },
    select: { id: true, storageKey: true },
  });
  const out: MultipleCurrentCandidates[] = [];
  for (const p of projects) {
    const sk = p.storageKey!;
    const candidates = await findCurrentMediaAssetCandidates(p.id, sk);
    if (candidates.length <= 1) continue;
    const chosen = pickCurrentMediaAssetFromCandidates(candidates);
    out.push({
      projectId: p.id,
      storageKey: sk,
      candidateIds: candidates.map((c) => c.id).sort(),
      chosenId: chosen?.id ?? "",
    });
  }
  return out;
}
