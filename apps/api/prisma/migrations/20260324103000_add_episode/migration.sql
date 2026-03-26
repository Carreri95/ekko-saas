-- CreateEnum
CREATE TYPE "EpisodeStatus" AS ENUM ('PENDING', 'TRANSCRIBING', 'DONE');

-- CreateTable
CREATE TABLE "Episode" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT,
    "status" "EpisodeStatus" NOT NULL DEFAULT 'PENDING',
    "subtitleFileId" TEXT,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Episode_projectId_number_key" ON "Episode"("projectId", "number");
CREATE INDEX "Episode_projectId_idx" ON "Episode"("projectId");

ALTER TABLE "Episode" ADD CONSTRAINT "Episode_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "DubbingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_subtitleFileId_fkey" FOREIGN KEY ("subtitleFileId") REFERENCES "SubtitleFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
