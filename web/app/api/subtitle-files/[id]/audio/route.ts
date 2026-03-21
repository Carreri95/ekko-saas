import { NextResponse } from "next/server";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

import { prisma } from "../../../../../src/lib/prisma";

type RouteParams = {
  params: Promise<{ id: string }>;
};

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

function mimeFromFilename(name: string): string {
  const ext = path.extname(name).toLowerCase();
  switch (ext) {
    case ".mp3":
      return "audio/mpeg";
    case ".m4a":
      return "audio/mp4";
    case ".webm":
      return "audio/webm";
    case ".wav":
      return "audio/wav";
    default:
      return "application/octet-stream";
  }
}

async function resolveAudioPath(
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

  // Caminhos relativos comuns (projeto, public, e legado com prefixos)
  pushCandidate(candidates, path.resolve(cwd, withoutLeadingSlash));
  pushCandidate(candidates, path.resolve(cwd, "public", withoutLeadingSlash));
  pushCandidate(candidates, path.resolve(cwd, withoutPublicPrefix));
  pushCandidate(candidates, path.resolve(cwd, "public", withoutPublicPrefix));
  pushCandidate(candidates, path.resolve(cwd, withoutWebPublicPrefix));
  pushCandidate(candidates, path.resolve(cwd, "public", withoutWebPublicPrefix));

  // Candidatos em diretórios típicos de upload local.
  pushCandidate(candidates, path.resolve(cwd, "public", "uploads", "wav", baseName));
  if (wavFilename) {
    pushCandidate(candidates, path.resolve(cwd, "public", "uploads", "wav", wavFilename));
  }

  // Se o servidor rodar em subpasta, tenta também no diretório pai.
  pushCandidate(candidates, path.resolve(cwd, "..", "public", withoutLeadingSlash));
  pushCandidate(candidates, path.resolve(cwd, "..", "public", "uploads", "wav", baseName));
  if (wavFilename) {
    pushCandidate(candidates, path.resolve(cwd, "..", "public", "uploads", "wav", wavFilename));
  }

  for (const candidate of candidates) {
    if (await fileExists(candidate)) {
      return { resolved: candidate, tried: candidates };
    }
  }

  return { resolved: null, tried: candidates };
}

export async function GET(_: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "subtitleFileId obrigatorio" }, { status: 400 });
    }

    const subtitleFile = await prisma.subtitleFile.findUnique({
      where: { id },
      select: {
        wavPath: true,
        wavFilename: true,
      },
    });

    if (!subtitleFile) {
      return NextResponse.json({ error: "SubtitleFile nao encontrado" }, { status: 404 });
    }

    if (!subtitleFile.wavPath) {
      return NextResponse.json({ error: "Arquivo de audio nao configurado" }, { status: 404 });
    }

    const { resolved: diskPath, tried } = await resolveAudioPath(
      subtitleFile.wavPath,
      subtitleFile.wavFilename,
    );
    if (!diskPath) {
      return NextResponse.json(
        {
          error: "Arquivo de audio nao encontrado no disco",
          wavPath: subtitleFile.wavPath,
          wavFilename: subtitleFile.wavFilename,
          cwd: process.cwd(),
          tried,
        },
        { status: 404 },
      );
    }

    const bytes = await readFile(diskPath);
    const filename = subtitleFile.wavFilename ?? path.basename(diskPath);
    const contentType = mimeFromFilename(filename);

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[subtitle-file-audio] GET failed", error);
    return NextResponse.json({ error: "Falha interna ao servir audio" }, { status: 500 });
  }
}

