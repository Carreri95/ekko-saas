import { describe, expect, it } from "vitest";

import { MockTranscriptionAdapter } from "./mock-transcription.adapter";

describe("MockTranscriptionAdapter", () => {
  it("retorna transcript e rawResponse", async () => {
    const a = new MockTranscriptionAdapter();
    const r = await a.transcribe({ audioUrl: "/tmp/x.wav" });
    expect(r.rawResponse).toBeTruthy();
    expect(r.transcript.segments.length).toBeGreaterThan(0);
    expect(r.transcript.language).toBeTruthy();
  });
});
