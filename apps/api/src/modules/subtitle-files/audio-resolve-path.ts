import { stat } from "node:fs/promises";
import path from "node:path";

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

function pushCandidate(candidates: string[], value: string | null | undefined) {
  if (!value) return;
  if (!candidates.includes(value)) candidates.push(value);
}

/**
 * Portado de `apps/web/app/api/subtitle-files/[id]/audio/route.ts` (PR 5.5).
 * Inclui candidatos extra para `cwd` em `apps/api` e `MEDIA_STORAGE_DIR` (alinhado a `MediaStorageService`).
 */
export async function resolveAudioPath(
  rawWavPath: string,
  wavFilename: string | null,
): Promise<{ resolved: string | null; tried: string[] }> {
  const trimmed = rawWavPath.trim();
  if (!trimmed) return { resolved: null, tried: [] };

  const cwd = process.cwd();
  const normalized = trimmed
    .replace(/^file:\/\//i, "")
    .replace(/[?#].*$/, "")
    .replace(/\\/g, "/");
  const withoutLeadingSlash = normalized.replace(/^\/+/, "");
  const withoutPublicPrefix = withoutLeadingSlash.replace(/^public\//i, "");
  const withoutWebPublicPrefix = withoutLeadingSlash.replace(/^web\/public\//i, "");
  const baseName = path.basename(normalized);

  const candidates: string[] = [];

  if (path.isAbsolute(trimmed)) {
    pushCandidate(candidates, trimmed);
  }
  if (path.isAbsolute(normalized)) {
    pushCandidate(candidates, normalized);
  }

  pushCandidate(candidates, path.resolve(cwd, withoutLeadingSlash));
  pushCandidate(candidates, path.resolve(cwd, "public", withoutLeadingSlash));
  pushCandidate(candidates, path.resolve(cwd, withoutPublicPrefix));
  pushCandidate(candidates, path.resolve(cwd, "public", withoutPublicPrefix));
  pushCandidate(candidates, path.resolve(cwd, withoutWebPublicPrefix));
  pushCandidate(candidates, path.resolve(cwd, "public", withoutWebPublicPrefix));

  pushCandidate(candidates, path.resolve(cwd, "public", "uploads", "wav", baseName));
  if (wavFilename) {
    pushCandidate(candidates, path.resolve(cwd, "public", "uploads", "wav", wavFilename));
  }

  pushCandidate(candidates, path.resolve(cwd, "..", "public", withoutLeadingSlash));
  pushCandidate(candidates, path.resolve(cwd, "..", "public", "uploads", "wav", baseName));
  if (wavFilename) {
    pushCandidate(candidates, path.resolve(cwd, "..", "public", "uploads", "wav", wavFilename));
  }

  // PR 5.5 — API com cwd `apps/api`: ficheiros em sibling `apps/web/public/...`
  pushCandidate(candidates, path.resolve(cwd, "..", "web", "public", withoutLeadingSlash));
  pushCandidate(candidates, path.resolve(cwd, "..", "web", "public", withoutPublicPrefix));
  pushCandidate(candidates, path.resolve(cwd, "..", "web", "public", "uploads", "wav", baseName));
  if (wavFilename) {
    pushCandidate(candidates, path.resolve(cwd, "..", "web", "public", "uploads", "wav", wavFilename));
  }

  const mediaDir = process.env.MEDIA_STORAGE_DIR?.trim();
  if (mediaDir) {
    pushCandidate(candidates, path.resolve(mediaDir, baseName));
    if (wavFilename) {
      pushCandidate(candidates, path.resolve(mediaDir, path.basename(wavFilename)));
    }
  }

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return { resolved: candidate, tried: candidates };
    }
  }

  return { resolved: null, tried: candidates };
}
