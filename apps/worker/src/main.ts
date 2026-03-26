import "./load-env.js";
import { TranscriptionJobStatus } from "../../api/src/generated/prisma/client.js";

import { prisma } from "./prisma-client.js";
import { processOneInviteEmailDispatch } from "./invite-email/run-invite-email-dispatch.js";
import { MediaStorageService } from "./transcription/media-storage.service.js";
import { runTranscriptionJob } from "./transcription/transcription-job-runner.js";

console.log(
  JSON.stringify({
    scope: "env-debug",
    event: "worker_start",
    hasProcessEnvOpenAiKeyEncryptionSecret: Boolean(
      process.env.OPENAI_KEY_ENCRYPTION_SECRET?.trim(),
    ),
  }),
);

function pollMs(): number {
  const raw = process.env.WORKER_POLL_MS;
  if (!raw || raw.trim() === "") return 2000;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n >= 200 ? n : 2000;
}

let shuttingDown = false;

function log(event: string, payload: Record<string, unknown> = {}) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      scope: "worker-loop",
      event,
      ...payload,
    }),
  );
}

async function loop(): Promise<void> {
  const media = new MediaStorageService();
  log("worker_started", { pollMs: pollMs(), mediaRoot: media.getRootDir() });

  while (!shuttingDown) {
    try {
      const didInviteEmail = await processOneInviteEmailDispatch(prisma);
      if (didInviteEmail) {
        continue;
      }

      const next = await prisma.transcriptionJob.findFirst({
        where: { status: TranscriptionJobStatus.PENDING },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });

      if (!next) {
        await new Promise((r) => setTimeout(r, pollMs()));
        continue;
      }

      log("job_picked", { jobId: next.id });
      await runTranscriptionJob(prisma, media, next.id, {});
    } catch (e) {
      log("loop_error", { error: e instanceof Error ? e.message : String(e) });
      await new Promise((r) => setTimeout(r, pollMs()));
    }
  }

  log("worker_stopped");
}

function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;
  log("shutdown_signal", { signal });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

void loop().finally(async () => {
  await prisma.$disconnect();
  process.exit(0);
});
