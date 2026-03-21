import type { RawTranscript, TranscriptionInput } from "./types";

/** Resultado da transcrição: transcript normalizável + payload bruto para persistência e reprocessamento. */
export type TranscriptionAdapterResult = {
  transcript: RawTranscript;
  rawResponse: unknown;
};

export interface TranscriptionAdapter {
  transcribe(input: TranscriptionInput): Promise<TranscriptionAdapterResult>;
}
