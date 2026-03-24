import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getMaxFileSizeBytes } from "./media-env.js";

export type MediaSaveResult = {
  storageKey: string;
  sizeBytes: number;
};

const ALLOWED_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/m4a",
  "audio/x-m4a",
  "audio/mp4",
  "audio/webm",
]);

function extFromMime(mime: string): string {
  const m = mime.toLowerCase().split(";")[0]?.trim() ?? "";
  switch (m) {
    case "audio/mpeg":
    case "audio/mp3":
      return ".mp3";
    case "audio/wav":
    case "audio/x-wav":
      return ".wav";
    case "audio/m4a":
    case "audio/x-m4a":
    case "audio/mp4":
      return ".m4a";
    case "audio/webm":
      return ".webm";
    default:
      return "";
  }
}

/**
 * Diretório de mídia alinhado ao Next: `apps/web/public/uploads/media`.
 * Com API a correr com cwd `apps/api`, o default resolve para o sibling `web`.
 */
function getMediaRoot(): string {
  const fromEnv = process.env.MEDIA_STORAGE_DIR;
  if (fromEnv && fromEnv.trim() !== "") {
    return path.resolve(fromEnv.trim());
  }
  return path.resolve(process.cwd(), "..", "web", "public", "uploads", "media");
}

export class MediaStorageService {
  getRootDir(): string {
    return getMediaRoot();
  }

  resolveAbsolutePath(storageKey: string): string {
    const safe = path.basename(storageKey);
    return path.join(this.getRootDir(), safe);
  }

  validateMimeType(mime: string): boolean {
    const base = mime.toLowerCase().split(";")[0]?.trim() ?? "";
    return ALLOWED_MIME.has(base);
  }

  validateSize(sizeBytes: number): boolean {
    return sizeBytes > 0 && sizeBytes <= getMaxFileSizeBytes();
  }

  async saveFile(params: {
    buffer: Buffer;
    mimeType: string;
    originalFilename?: string | null;
  }): Promise<MediaSaveResult> {
    const { buffer, mimeType } = params;
    const sizeBytes = buffer.byteLength;

    if (!this.validateMimeType(mimeType)) {
      throw new Error("MIME type de audio nao permitido");
    }
    if (!this.validateSize(sizeBytes)) {
      throw new Error("Arquivo excede o tamanho maximo permitido");
    }

    const ext = extFromMime(mimeType);
    if (!ext) {
      throw new Error("Extensao nao derivavel para o MIME informado");
    }

    const storageKey = `${randomUUID()}${ext}`;
    const root = this.getRootDir();
    await mkdir(root, { recursive: true });
    const absolute = path.join(root, storageKey);
    await writeFile(absolute, buffer);

    return {
      storageKey,
      sizeBytes,
    };
  }
}

let singleton: MediaStorageService | undefined;

export function getMediaStorageService(): MediaStorageService {
  singleton ??= new MediaStorageService();
  return singleton;
}
