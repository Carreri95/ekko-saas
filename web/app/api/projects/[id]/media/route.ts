import { NextResponse } from "next/server";

import { MediaKind } from "../../../../generated/prisma/client";
import { prisma } from "../../../../../src/lib/prisma";
import { findLatestSubtitleFileForProject } from "../../../../../src/server/subtitle-file-queries";
import { getAudioDurationMsFromBuffer } from "../../../../../src/server/transcription/audio-duration";
import { getMediaStorageService } from "../../../../../src/server/transcription/transcription-services";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const { id: projectId } = await params;
  if (!projectId) {
    return NextResponse.json({ error: "projectId obrigatorio" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Projeto nao encontrado" }, { status: 404 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "multipart invalido" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Campo file e obrigatorio" }, { status: 400 });
  }

  const mimeType = file.type || "application/octet-stream";
  const buffer = Buffer.from(await file.arrayBuffer());
  const originalName = file.name || null;

  const storage = getMediaStorageService();

  let saved: { storageKey: string; sizeBytes: number };
  try {
    saved = await storage.saveFile({
      buffer,
      mimeType,
      originalFilename: originalName,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const durationMs = await getAudioDurationMsFromBuffer(buffer, mimeType);

  await prisma.project.update({
    where: { id: projectId },
    data: {
      storageKey: saved.storageKey,
      mediaKind: MediaKind.audio,
      durationMs: durationMs ?? null,
    },
  });

  const publicPath = `/uploads/media/${saved.storageKey}`;
  const wavFilename = originalName ?? saved.storageKey;

  const existing = await findLatestSubtitleFileForProject(prisma, projectId);

  let subtitleFileId: string;

  if (existing) {
    const updated = await prisma.subtitleFile.update({
      where: { id: existing.id },
      data: {
        filename: wavFilename,
        wavFilename,
        wavPath: publicPath,
      },
      select: { id: true },
    });
    subtitleFileId = updated.id;
  } else {
    const created = await prisma.subtitleFile.create({
      data: {
        projectId,
        filename: wavFilename,
        wavFilename,
        wavPath: publicPath,
      },
      select: { id: true },
    });
    subtitleFileId = created.id;
  }

  return NextResponse.json({
    storageKey: saved.storageKey,
    sizeBytes: saved.sizeBytes,
    durationMs,
    subtitleFileId,
    publicPath,
  });
}
