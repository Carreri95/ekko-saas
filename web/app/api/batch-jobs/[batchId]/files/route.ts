import { NextResponse } from "next/server";

import { TranscriptionEngine } from "../../../../generated/prisma/client";
import { getBatchJobService } from "../../../../../src/server/transcription/transcription-services";

type RouteParams = { params: Promise<{ batchId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  const { batchId } = await params;
  if (!batchId) {
    return NextResponse.json({ error: "batchId obrigatorio" }, { status: 400 });
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

  const engineRaw = String(form.get("engine") ?? "OPENAI_WHISPER").toUpperCase();
  const engine =
    engineRaw === "MOCK"
      ? TranscriptionEngine.MOCK
      : TranscriptionEngine.OPENAI_WHISPER;

  const languageRaw = form.get("language");
  const language =
    typeof languageRaw === "string" && languageRaw.trim() !== ""
      ? languageRaw.trim()
      : null;

  const exportFormat = String(form.get("exportFormat") ?? "SRT").toUpperCase();

  const mimeType = file.type || "application/octet-stream";
  const buffer = Buffer.from(await file.arrayBuffer());
  const originalFilename = file.name || "audio.bin";

  try {
    const result = await getBatchJobService().addFileFromUpload({
      batchId,
      buffer,
      mimeType,
      originalFilename,
      engine,
      language,
      exportFormat,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("nao encontrado")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    if (msg.includes("nao aceita")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
