import type { MediaAsset } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/db/prisma.client.js";
import { loadStorageConfig } from "../../infrastructure/storage/storage-config.js";
import {
  LOCAL_MEDIA_ASSET_BUCKET,
  LOCAL_MEDIA_ASSET_STORAGE_PROVIDER,
} from "./media-asset-dual-write.js";
import {
  buildRemoteObjectKey,
  REMOTE_MEDIA_STORAGE_PROVIDER,
} from "./project-media-minio-replication.js";

const DEFAULT_REMOTE_BUCKET = "subtitlebot-media";

/**
 * Bucket remoto esperado para comparação com `MediaAsset` (env / config).
 * Alinha com `S3_BUCKET_MEDIA` por defeito quando storage não está `ready`.
 */
export function getExpectedRemoteBucketName(): string {
  const state = loadStorageConfig();
  if (state.status === "ready") {
    return state.config.bucketMedia;
  }
  return process.env.S3_BUCKET_MEDIA?.trim() || DEFAULT_REMOTE_BUCKET;
}

/** Identidade local canónica (PR 5.2) para `Project.storageKey`. */
export function buildExpectedLocalIdentity(storageKey: string) {
  return {
    storageProvider: LOCAL_MEDIA_ASSET_STORAGE_PROVIDER,
    bucket: LOCAL_MEDIA_ASSET_BUCKET,
    objectKey: storageKey,
  };
}

/** Identidade remota canónica (PR 5.3) para `Project.storageKey`. */
export function buildExpectedRemoteIdentity(projectId: string, storageKey: string) {
  return {
    storageProvider: REMOTE_MEDIA_STORAGE_PROVIDER,
    bucket: getExpectedRemoteBucketName(),
    objectKey: buildRemoteObjectKey(projectId, storageKey),
  };
}

/**
 * Lista todos os `MediaAsset` que correspondem ao blob corrente (local OU remoto esperado).
 */
export async function findCurrentMediaAssetCandidates(
  projectId: string,
  storageKey: string,
): Promise<MediaAsset[]> {
  const local = buildExpectedLocalIdentity(storageKey);
  const remote = buildExpectedRemoteIdentity(projectId, storageKey);

  return prisma.mediaAsset.findMany({
    where: {
      OR: [
        {
          storageProvider: local.storageProvider,
          bucket: local.bucket,
          objectKey: local.objectKey,
        },
        {
          storageProvider: remote.storageProvider,
          bucket: remote.bucket,
          objectKey: remote.objectKey,
        },
      ],
    },
  });
}

/**
 * Desempate: `createdAt` mais recente; se empate, `id` lexicograficamente maior.
 */
export function pickCurrentMediaAssetFromCandidates(candidates: MediaAsset[]): MediaAsset | null {
  if (candidates.length === 0) return null;
  const sorted = [...candidates].sort((a, b) => {
    const td = b.createdAt.getTime() - a.createdAt.getTime();
    if (td !== 0) return td;
    return b.id.localeCompare(a.id);
  });
  return sorted[0] ?? null;
}

/**
 * `MediaAsset` corrente para `Project.storageKey` (fonte de verdade: `storageKey`).
 * `storageKey` null/vazio ⇒ sem asset corrente.
 */
export async function resolveCurrentMediaAsset(
  projectId: string,
  storageKey: string | null | undefined,
): Promise<MediaAsset | null> {
  if (storageKey == null || String(storageKey).trim() === "") {
    return null;
  }
  const candidates = await findCurrentMediaAssetCandidates(projectId, storageKey);
  return pickCurrentMediaAssetFromCandidates(candidates);
}
