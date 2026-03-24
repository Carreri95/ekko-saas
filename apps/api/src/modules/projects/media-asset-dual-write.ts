import { createHash } from "node:crypto";

import {
  MediaAssetKind,
  MediaAssetStatus,
  MediaVisibility,
} from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/db/prisma.client.js";

/**
 * Convenção PR 5.2 — ficheiros no disco local (`public/uploads/media`), sem MinIO no write path.
 * - `bucket`: sentinela fixa para não colidir com nomes de buckets S3 reais.
 * - `objectKey`: igual ao `storageKey` (nome opaco do ficheiro, ex. UUID + extensão), único por bucket.
 * - `storageProvider`: "local".
 */
export const LOCAL_MEDIA_ASSET_BUCKET = "local";
export const LOCAL_MEDIA_ASSET_STORAGE_PROVIDER = "local";

export type LocalUploadMirrorParams = {
  projectId: string;
  /** PR 5.4 — `SubtitleFile` ativo após `POST .../media`. */
  subtitleFileId: string;
  storageKey: string;
  sizeBytes: number;
  mimeType: string;
  originalFilename: string;
  buffer: Buffer;
};

/**
 * Cria `MediaAsset` como espelho canónico do upload local.
 * Nunca lança: falhas são registadas e o upload legado deve continuar bem-sucedido.
 */
export async function tryCreateMediaAssetForLocalUpload(
  params: LocalUploadMirrorParams,
): Promise<void> {
  const {
    projectId,
    subtitleFileId,
    storageKey,
    sizeBytes,
    mimeType,
    originalFilename,
    buffer,
  } = params;

  let checksumSha256: string;
  try {
    checksumSha256 = createHash("sha256").update(buffer).digest("hex");
  } catch (e) {
    console.error(
      "[MediaAsset dual-write] falha ao calcular SHA-256 (upload legado OK)",
      {
        projectId,
        storageKey,
        error: e instanceof Error ? e.message : String(e),
      },
    );
    return;
  }

  try {
    const created = await prisma.mediaAsset.create({
      data: {
        kind: MediaAssetKind.AUDIO,
        status: MediaAssetStatus.READY,
        visibility: MediaVisibility.PRIVATE,
        storageProvider: LOCAL_MEDIA_ASSET_STORAGE_PROVIDER,
        bucket: LOCAL_MEDIA_ASSET_BUCKET,
        objectKey: storageKey,
        originalFilename,
        mimeType,
        sizeBytes: BigInt(sizeBytes),
        checksumSha256,
        subtitleFileId,
      },
    });
    console.log(
      JSON.stringify({
        msg: "[PR 5.4] MediaAsset canonical state",
        projectId,
        canonicalStorageKey: storageKey,
        subtitleFileId,
        mediaAssetId: created.id,
        mode: "local",
      }),
    );
  } catch (e) {
    console.error(
      "[MediaAsset dual-write] falha ao criar MediaAsset (upload legado OK; inconsistência transitória)",
      {
        projectId,
        storageKey,
        bucket: LOCAL_MEDIA_ASSET_BUCKET,
        error: e instanceof Error ? e.message : String(e),
      },
    );
  }
}
