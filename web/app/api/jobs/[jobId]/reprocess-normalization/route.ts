import { NextResponse } from "next/server";

import {
  SubtitleSourceType,
  TranscriptionJobStatus,
} from "../../../../generated/prisma/client";
import { prisma } from "../../../../../src/lib/prisma";
import { CueRepository } from "../../../../../src/server/transcription/cue-repository";
import { parseStoredRawResponseToTranscript } from "../../../../../src/server/transcription/raw-response-to-transcript";
import { normalizeTranscript } from "../../../../../src/server/transcription/transcript-normalizer";

type RouteParams = { params: Promise<{ jobId: string }> };

/**
 * Reaplica `TranscriptNormalizer` sobre `rawResponse` já guardado, sem chamar a API
 * de transcrição. Útil para afinar cleanText/regras sem custo extra.
 */
export async function POST(_: Request, { params }: RouteParams) {
  const { jobId } = await params;
  if (!jobId) {
    return NextResponse.json({ error: "jobId obrigatorio" }, { status: 400 });
  }

  const job = await prisma.transcriptionJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      status: true,
      rawResponse: true,
      subtitleFileId: true,
      projectId: true,
    },
  });

  if (!job) {
    return NextResponse.json({ error: "Job nao encontrado" }, { status: 404 });
  }

  if (job.status === TranscriptionJobStatus.PENDING || job.status === TranscriptionJobStatus.RUNNING) {
    return NextResponse.json(
      { error: "Job ainda em execucao; aguarde DONE ou FAILED com rawResponse" },
      { status: 409 },
    );
  }

  if (job.rawResponse === null || job.rawResponse === undefined) {
    return NextResponse.json(
      {
        error:
          "Este job nao tem rawResponse guardado. So e possivel re-normalizar apos uma transcrição que tenha persistido a resposta bruta.",
      },
      { status: 400 },
    );
  }

  let transcript;
  try {
    transcript = parseStoredRawResponseToTranscript(job.rawResponse);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Falha ao ler rawResponse: ${msg}` }, { status: 400 });
  }

  const cues = normalizeTranscript(transcript);

  await prisma.$transaction(async (tx) => {
    await new CueRepository(tx).saveBatchForTranscription({
      subtitleFileId: job.subtitleFileId,
      jobId: job.id,
      cues,
    });

    await tx.subtitleFile.update({
      where: { id: job.subtitleFileId },
      data: {
        language: transcript.language,
        sourceType: SubtitleSourceType.IMPORTED_WHISPER,
      },
    });

    await tx.transcriptionJob.update({
      where: { id: job.id },
      data: {
        language: transcript.language,
      },
    });
  });

  return NextResponse.json({
    jobId: job.id,
    projectId: job.projectId,
    subtitleFileId: job.subtitleFileId,
    cueCount: cues.length,
    language: transcript.language,
  });
}
