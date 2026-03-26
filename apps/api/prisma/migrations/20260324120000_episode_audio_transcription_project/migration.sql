-- AlterTable
ALTER TABLE "Episode" ADD COLUMN     "audioFileId" TEXT,
ADD COLUMN     "transcriptionProjectId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Episode_transcriptionProjectId_key" ON "Episode"("transcriptionProjectId");

-- CreateIndex
CREATE INDEX "Episode_audioFileId_idx" ON "Episode"("audioFileId");

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_audioFileId_fkey" FOREIGN KEY ("audioFileId") REFERENCES "SubtitleFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Episode" ADD CONSTRAINT "Episode_transcriptionProjectId_fkey" FOREIGN KEY ("transcriptionProjectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
