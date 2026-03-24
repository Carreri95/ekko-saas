/** Tipos mínimos para normalização de transcript / cues (PR 6.2.2). */

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
