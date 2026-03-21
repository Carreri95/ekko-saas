import { NextResponse } from "next/server";

import { getTranscriptionJobService } from "../../../../../src/server/transcription/transcription-services";

type RouteParams = { params: Promise<{ jobId: string }> };

type Body = {
  language?: string;
  prompt?: string;
};

export async function POST(request: Request, { params }: RouteParams) {
  const { jobId } = await params;
  if (!jobId) {
    return NextResponse.json({ error: "jobId obrigatorio" }, { status: 400 });
  }

  let body: Body = {};
  try {
    const text = await request.text();
    if (text && text.trim() !== "") {
      body = JSON.parse(text) as Body;
    }
  } catch {
    return NextResponse.json({ error: "Body JSON invalido" }, { status: 400 });
  }

  const svc = getTranscriptionJobService();
  const result = await svc.retry(jobId, {
    language: body.language,
    prompt: body.prompt,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error.includes("nao encontrado") ? 404 : 400 });
  }

  return NextResponse.json({ jobId: result.jobId, status: "PENDING" });
}
