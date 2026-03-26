import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { createS3Client } from "../../infrastructure/storage/s3-client.js";
import { loadStorageConfig } from "../../infrastructure/storage/storage-config.js";
import { checkStorageHealth } from "../../infrastructure/storage/storage-health.service.js";

const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function extFromMime(mime: string): string {
  const base = mime.toLowerCase().split(";")[0]?.trim() ?? "";
  switch (base) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    default:
      return "";
  }
}

function publicUrlForS3Object(
  endpoint: string,
  bucket: string,
  objectKey: string,
): string {
  const base = endpoint.replace(/\/$/, "");
  return `${base}/${bucket}/${objectKey}`;
}

function getAvatarsLocalDir(): string {
  const fromEnv = process.env.AVATAR_STORAGE_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  return path.resolve(process.cwd(), "..", "web", "public", "uploads", "avatars");
}

/**
 * Grava o avatar no MinIO (quando configurado e saudável) ou em disco local
 * (`apps/web/public/uploads/avatars`), e devolve a URL pública a guardar em `User.avatarUrl`.
 */
export async function storeUserAvatar(params: {
  userId: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<{ ok: true; avatarUrl: string } | { ok: false; error: string }> {
  const { userId, buffer } = params;
  const mimeType = params.mimeType.toLowerCase().split(";")[0]?.trim() ?? "";

  if (!ALLOWED_MIME.has(mimeType)) {
    return { ok: false, error: "Tipo de imagem nao permitido (use JPEG, PNG, WebP ou GIF)" };
  }
  if (buffer.byteLength <= 0 || buffer.byteLength > AVATAR_MAX_BYTES) {
    return { ok: false, error: "Imagem invalida ou demasiado grande (max 5MB)" };
  }

  const ext = extFromMime(mimeType);
  if (!ext) {
    return { ok: false, error: "Extensao nao suportada" };
  }

  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80) || "user";
  const objectFile = `${randomUUID()}${ext}`;
  const objectKey = `avatars/v1/${safeUser}/${objectFile}`;

  const configState = loadStorageConfig();
  if (configState.status === "ready") {
    const health = await checkStorageHealth();
    if (health.ok && health.mode === "ok") {
      const { config } = configState;
      const client = createS3Client(config);
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: config.bucketMedia,
            Key: objectKey,
            Body: buffer,
            ContentType: mimeType,
            CacheControl: "public, max-age=31536000",
          }),
        );
        const avatarUrl = publicUrlForS3Object(
          config.endpoint,
          config.bucketMedia,
          objectKey,
        );
        return { ok: true, avatarUrl };
      } catch (e) {
        console.error("[avatar-upload] PutObject falhou, a tentar fallback local", {
          objectKey,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  const dir = getAvatarsLocalDir();
  await mkdir(dir, { recursive: true });
  const filename = `${safeUser}-${objectFile}`;
  const absolute = path.join(dir, filename);
  await writeFile(absolute, buffer);
  const avatarUrl = `/uploads/avatars/${filename}`;
  return { ok: true, avatarUrl };
}
