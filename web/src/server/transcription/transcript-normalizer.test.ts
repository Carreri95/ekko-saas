import { describe, expect, it } from "vitest";

import { cleanText, normalizeTranscript } from "./transcript-normalizer";

describe("cleanText", () => {
  it("remove espacos e artefatos [Music]", () => {
    expect(cleanText("  ola   mundo  ")).toBe("ola mundo");
    expect(cleanText("[Music]")).toBe("");
  });
});

describe("normalizeTranscript", () => {
  it("converte segmentos e descarta vazios", () => {
    const cues = normalizeTranscript({
      language: "pt",
      durationSec: 10,
      segments: [
        { start: 0, end: 1, text: "  A  " },
        { start: 1, end: 1, text: "   " },
        { start: 2, end: 3, text: "B" },
      ],
    });
    expect(cues).toHaveLength(2);
    expect(cues[0]).toMatchObject({ cueIndex: 1, startMs: 0, endMs: 1000, text: "A" });
    expect(cues[1]).toMatchObject({ cueIndex: 2, startMs: 2000, endMs: 3000, text: "B" });
  });

  it("corrige endMs <= startMs", () => {
    const cues = normalizeTranscript({
      language: "pt",
      durationSec: 1,
      segments: [{ start: 1, end: 1, text: "x" }],
    });
    expect(cues[0].endMs).toBeGreaterThan(cues[0].startMs);
  });
});
