-- CreateEnum
CREATE TYPE "RecordingSessionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- CreateEnum
CREATE TYPE "RecordingSessionFormat" AS ENUM ('REMOTE', 'IN_PERSON');

-- CreateTable
CREATE TABLE "RecordingSession" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "episodeId" TEXT,
    "characterId" TEXT,
    "castMemberId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "status" "RecordingSessionStatus" NOT NULL DEFAULT 'PENDING',
    "format" "RecordingSessionFormat" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecordingSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecordingSession_projectId_idx" ON "RecordingSession"("projectId");

-- CreateIndex
CREATE INDEX "RecordingSession_castMemberId_idx" ON "RecordingSession"("castMemberId");

-- CreateIndex
CREATE INDEX "RecordingSession_episodeId_idx" ON "RecordingSession"("episodeId");

-- CreateIndex
CREATE INDEX "RecordingSession_characterId_idx" ON "RecordingSession"("characterId");

-- CreateIndex
CREATE INDEX "RecordingSession_projectId_startAt_idx" ON "RecordingSession"("projectId", "startAt");

-- AddForeignKey
ALTER TABLE "RecordingSession" ADD CONSTRAINT "RecordingSession_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "DubbingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingSession" ADD CONSTRAINT "RecordingSession_episodeId_fkey" FOREIGN KEY ("episodeId") REFERENCES "Episode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingSession" ADD CONSTRAINT "RecordingSession_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "ProjectCharacter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecordingSession" ADD CONSTRAINT "RecordingSession_castMemberId_fkey" FOREIGN KEY ("castMemberId") REFERENCES "CastMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
