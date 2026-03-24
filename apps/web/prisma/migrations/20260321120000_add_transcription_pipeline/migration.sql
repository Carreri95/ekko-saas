-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('audio', 'video');

-- CreateEnum
CREATE TYPE "TranscriptionJobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "TranscriptionEngine" AS ENUM ('OPENAI_WHISPER', 'MOCK');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "storageKey" TEXT,
ADD COLUMN     "mediaKind" "MediaKind",
ADD COLUMN     "durationMs" INTEGER;

-- AlterTable
ALTER TABLE "SubtitleCue" ADD COLUMN     "transcriptionJobId" TEXT;

-- CreateTable
CREATE TABLE "TranscriptionJob" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "subtitleFileId" TEXT NOT NULL,
    "status" "TranscriptionJobStatus" NOT NULL DEFAULT 'PENDING',
    "engine" "TranscriptionEngine" NOT NULL DEFAULT 'OPENAI_WHISPER',
    "language" TEXT,
    "errorMessage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "rawResponse" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TranscriptionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TranscriptionJob_projectId_idx" ON "TranscriptionJob"("projectId");

-- CreateIndex
CREATE INDEX "TranscriptionJob_subtitleFileId_idx" ON "TranscriptionJob"("subtitleFileId");

-- CreateIndex
CREATE INDEX "SubtitleCue_subtitleFileId_startMs_idx" ON "SubtitleCue"("subtitleFileId", "startMs");

-- AddForeignKey
ALTER TABLE "SubtitleCue" ADD CONSTRAINT "SubtitleCue_transcriptionJobId_fkey" FOREIGN KEY ("transcriptionJobId") REFERENCES "TranscriptionJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptionJob" ADD CONSTRAINT "TranscriptionJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TranscriptionJob" ADD CONSTRAINT "TranscriptionJob_subtitleFileId_fkey" FOREIGN KEY ("subtitleFileId") REFERENCES "SubtitleFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
