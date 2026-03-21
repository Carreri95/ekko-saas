import type { TranscriptionAdapter, TranscriptionAdapterResult } from "./transcription-adapter";
import type { TranscriptionInput } from "./types";

/** Adapter determinístico para testes e desenvolvimento sem API. */
export class MockTranscriptionAdapter implements TranscriptionAdapter {
  async transcribe(input: TranscriptionInput): Promise<TranscriptionAdapterResult> {
    const rawResponse = {
      language: input.language ?? "portuguese",
      duration: 3.2,
      segments: [
        { id: 0, start: 0, end: 1.5, text: " Ola do mock " },
        { id: 1, start: 1.5, end: 3.2, text: " segunda linha" },
      ],
    };

    return {
      rawResponse,
      transcript: {
        language: String(rawResponse.language),
        durationSec: rawResponse.duration,
        segments: rawResponse.segments.map((s) => ({
          start: s.start,
          end: s.end,
          text: s.text,
        })),
      },
    };
  }
}
