/** Contrato do adapter — o restante do sistema não conhece OpenAI. */
export type TranscriptionInput = {
  /**
   * Caminho absoluto do arquivo no servidor ou URL http(s) acessível ao adapter.
   * O OpenAIWhisperAdapter lê arquivo local quando `audioUrl` é path absoluto ou `file:`.
   */
  audioUrl: string;
  language?: string;
  prompt?: string;
  /**
   * Chave OpenAI só em memória (ex.: gerador em lote via header). Não persistir.
   * Se omitido, usa `OPENAI_API_KEY` do ambiente.
   */
  openaiApiKey?: string;
};

export type RawSegment = {
  start: number;
  end: number;
  text: string;
};

export type RawTranscript = {
  segments: RawSegment[];
  language: string;
  durationSec: number;
};

export type NormalizedCue = {
  cueIndex: number;
  startMs: number;
  endMs: number;
  text: string;
};

export type MediaSaveResult = {
  storageKey: string;
  sizeBytes: number;
  durationHintSec?: number;
};
