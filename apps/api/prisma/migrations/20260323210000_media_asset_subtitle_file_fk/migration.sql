-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN "subtitleFileId" TEXT;

-- CreateIndex
CREATE INDEX "MediaAsset_subtitleFileId_idx" ON "MediaAsset"("subtitleFileId");

-- AddForeignKey
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_subtitleFileId_fkey" FOREIGN KEY ("subtitleFileId") REFERENCES "SubtitleFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
