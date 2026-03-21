import { describe, expect, it } from "vitest";

import { parseStoredRawResponseToTranscript } from "./raw-response-to-transcript";

describe("parseStoredRawResponseToTranscript", () => {
  it("aceita formato estilo OpenAI verbose_json", () => {
    const t = parseStoredRawResponseToTranscript({
      language: "portuguese",
      duration: 3.2,
      segments: [
        { id: 0, start: 0, end: 1.5, text: " a " },
        { id: 1, start: 1.5, end: 3.2, text: "b" },
      ],
    });
    expect(t.language).toBe("portuguese");
    expect(t.durationSec).toBe(3.2);
    expect(t.segments).toHaveLength(2);
  });

  it("rejeita payload sem segments", () => {
    expect(() => parseStoredRawResponseToTranscript({})).toThrow(/segments/);
  });
});
