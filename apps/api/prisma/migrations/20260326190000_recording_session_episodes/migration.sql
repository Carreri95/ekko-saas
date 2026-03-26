-- CreateTable
CREATE TABLE "RecordingSessionEpisode" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "episodeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecordingSessionEpisode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecordingSessionEpisode_sessionId_episodeId_key" ON "RecordingSessionEpisode"("sessionId", "episodeId");

-- CreateIndex
CREATE INDEX "RecordingSessionEpisode_sessionId_idx" ON "RecordingSessionEpisode"("sessionId");

-- CreateIndex
CREATE INDEX "RecordingSessionEpisode_episodeId_idx" ON "RecordingSessionEpisode"("episodeId");

-- AddForeignKey
ALTER TABLE "RecordingSessionEpisode" ADD CONSTRAINT "RecordingSessionEpisode_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "RecordingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingSessionEpisode" ADD CONSTRAINT "RecordingSessionEpisode_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: uma linha por sessão que já tinha episódio único
INSERT INTO "RecordingSessionEpisode" ("id", "sessionId", "episodeId", "createdAt")
SELECT gen_random_uuid()::text, rs."id", rs."episodeId", NOW()
FROM "RecordingSession" rs
WHERE rs."episodeId" IS NOT NULL;
