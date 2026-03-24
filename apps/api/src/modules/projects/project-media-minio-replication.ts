import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createHash } from "node:crypto";

import {
  MediaAssetKind,
  MediaAssetStatus,
  MediaVisibility,
} from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/db/prisma.client.js";
import { checkStorageHealth } from "../../infrastructure/storage/storage-health.service.js";
import { createS3Client } from "../../infrastructure/storage/s3-client.js";
import { loadStorageConfig } from "../../infrastructure/storage/storage-config.js";
import { tryCreateMediaAssetForLocalUpload } from "./media-asset-dual-write.js";

/** Valor canónico em BD quando o objeto existe no MinIO/S3-compatible (PR 5.3). */
export const REMOTE_MEDIA_STORAGE_PROVIDER = "s3-compatible";

/**
 * Chave no bucket remoto: isolamento por projeto + mesmo nome opaco do disco.
 * Evita colisões e alinha com `docs/architecture/storage.md` (prefixo estável por fase).
 */
export function buildRemoteObjectKey(projectId: string, storageKey: string): string {
  const safeProject = projectId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "project";
  const safeKey = storageKey.replace(/[/\\]/g, "");
  return `media/v1/${safeProject}/${safeKey}`;
}

export type ReplicationParams = {
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
 * Após upload local bem-sucedido: tenta PutObject no MinIO e cria `MediaAsset` remoto.
 * Se MinIO não estiver configurado, indisponível ou a replicação falhar, cria só o espelho local (PR 5.2).
 * Nunca lança para o handler HTTP.
 */
export async function tryReplicateProjectMediaAfterLocalSave(
  params: ReplicationParams,
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

  const configState = loadStorageConfig();
  if (configState.status !== "ready") {
    await tryCreateMediaAssetForLocalUpload(params);
    return;
  }

  const health = await checkStorageHealth();
  if (!health.ok || health.mode !== "ok") {
    console.error(
      "[PR 5.3] Storage remoto indisponível ou inválido — MediaAsset apenas local (upload legado OK)",
      {
        projectId,
        storageKey,
        healthMode: health.ok ? health.mode : "error",
        message: health.ok ? undefined : health.message,
      },
    );
    await tryCreateMediaAssetForLocalUpload(params);
    return;
  }

  const { config } = configState;
  const bucket = config.bucketMedia;
  const objectKey = buildRemoteObjectKey(projectId, storageKey);
  const client = createS3Client(config);

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        Body: buffer,
        ContentType: mimeType.split(";")[0]?.trim() || "application/octet-stream",
      }),
    );
  } catch (e) {
    console.error(
      "[PR 5.3] PutObject falhou — MediaAsset apenas local (upload legado OK; inconsistência transitória)",
      {
        projectId,
        storageKey,
        bucket,
        objectKey,
        error: e instanceof Error ? e.message : String(e),
      },
    );
    await tryCreateMediaAssetForLocalUpload(params);
    return;
  }

  let checksumSha256: string;
  try {
    checksumSha256 = createHash("sha256").update(buffer).digest("hex");
  } catch (e) {
    console.error(
      "[PR 5.3] Falha ao calcular SHA-256 após replicação remota (upload legado OK)",
      { projectId, storageKey, error: e instanceof Error ? e.message : String(e) },
    );
    await tryCreateMediaAssetForLocalUpload(params);
    return;
  }

  try {
    const created = await prisma.mediaAsset.create({
      data: {
        kind: MediaAssetKind.AUDIO,
        status: MediaAssetStatus.READY,
        visibility: MediaVisibility.PRIVATE,
        storageProvider: REMOTE_MEDIA_STORAGE_PROVIDER,
        bucket,
        objectKey,
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
        mode: "s3-compatible",
      }),
    );
  } catch (e) {
    console.error(
      "[PR 5.3] Falha ao criar MediaAsset remoto após PutObject (objeto pode existir no bucket; upload legado OK)",
      {
        projectId,
        storageKey,
        bucket,
        objectKey,
        error: e instanceof Error ? e.message : String(e),
      },
    );
    await tryCreateMediaAssetForLocalUpload(params);
  }
}
