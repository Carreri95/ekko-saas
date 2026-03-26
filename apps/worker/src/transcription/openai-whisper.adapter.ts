import type { TranscriptionAdapter, TranscriptionAdapterResult } from "./transcription-adapter.js";
import type { RawTranscript, TranscriptionInput } from "./types.js";
import { getOpenAIApiKey } from "./env.js";
import { buildWhisperAudioParts } from "./whisper-audio-prep.js";

type VerboseJsonSegment = {
  id?: number;
  start: number;
  end: number;
  text: string;
};

type VerboseJsonResponse = {
  language?: string;
  duration?: number;
  segments?: VerboseJsonSegment[];
};

function toLocalPath(audioUrl: string): string {
  if (audioUrl.startsWith("file://")) {
    return audioUrl.replace(/^file:\/\//i, "");
  }
  return audioUrl;
}

async function postVerboseTranscription(params: {
  apiKey: string;
  buffer: Buffer;
  fileName: string;
  language?: string;
  prompt?: string;
}): Promise<VerboseJsonResponse> {
  const form = new FormData();
  const blob = new Blob([new Uint8Array(params.buffer)]);
  form.append("file", blob, params.fileName);
  form.append("model", "whisper-1");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");
  if (params.language) {
    form.append("language", params.language);
  }
  if (params.prompt) {
    form.append("prompt", params.prompt);
  }

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
    },
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    let detail = errText.slice(0, 800);
    try {
      const j = JSON.parse(errText) as {
        error?: { message?: string; code?: string };
      };
      if (j?.error?.message) {
        detail = j.error.message;
      }
    } catch {
      /* texto não-JSON */
    }
    throw new Error(
      `OpenAI transcription falhou: ${res.status} ${res.statusText}${detail ? ` — ${detail}` : ""}`,
    );
  }

  return (await res.json()) as VerboseJsonResponse;
}

export class OpenAIWhisperAdapter implements TranscriptionAdapter {
  async transcribe(input: TranscriptionInput): Promise<TranscriptionAdapterResult> {
    const fromInput = input.openaiApiKey?.trim();
    const apiKey = fromInput && fromInput !== "" ? fromInput : getOpenAIApiKey();
    if (!apiKey) {
      throw new Error(
        "Chave OpenAI não configurada para o utilizador e OPENAI_API_KEY ausente no ambiente.",
      );
    }

    const filePath = toLocalPath(input.audioUrl);
    const parts = await buildWhisperAudioParts(filePath);

    const mergedSegments: VerboseJsonSegment[] = [];
    let language = "unknown";
    let lastRaw: unknown = null;

    for (const part of parts) {
      const json = await postVerboseTranscription({
        apiKey,
        buffer: part.buffer,
        fileName: part.fileName,
        language: input.language,
        prompt: input.prompt,
      });

      lastRaw = json;
      const off = part.timeOffsetSec;

      if (typeof json.language === "string" && json.language.trim() !== "") {
        language = json.language;
      }

      for (const s of json.segments ?? []) {
        mergedSegments.push({
          ...s,
          start: Number(s.start) + off,
          end: Number(s.end) + off,
        });
      }
    }

    const segments = mergedSegments.map((s) => ({
      start: Number(s.start),
      end: Number(s.end),
      text: String(s.text ?? ""),
    }));

    const durationSec =
      segments.length > 0
        ? Math.max(...segments.map((s) => s.end))
        : typeof (lastRaw as VerboseJsonResponse)?.duration === "number"
          ? Number((lastRaw as VerboseJsonResponse).duration)
          : 0;

    const transcript: RawTranscript = {
      segments,
      language,
      durationSec,
    };

    return {
      transcript,
      rawResponse: lastRaw,
    };
  }
}
