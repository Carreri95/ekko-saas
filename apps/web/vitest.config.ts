import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    /** Após remoção do legado `src/server/transcription/*.test.ts` (PR 8.2), não falhar CI. */
    passWithNoTests: true,
  },
});
