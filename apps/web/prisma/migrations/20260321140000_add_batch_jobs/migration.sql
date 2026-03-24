-- CreateEnum
CREATE TYPE "BatchJobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- CreateTable
CREATE TABLE "BatchJob" (
    "id" TEXT NOT NULL,
    "status" "BatchJobStatus" NOT NULL DEFAULT 'PENDING',
    "engine" "TranscriptionEngine" NOT NULL DEFAULT 'OPENAI_WHISPER',
    "language" TEXT,
    "zipStorageKey" TEXT,
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BatchJob_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "TranscriptionJob" ADD COLUMN "batchId" TEXT,
ADD COLUMN "originalFilename" TEXT,
ADD COLUMN "exportFormat" TEXT DEFAULT 'SRT';

-- CreateIndex
CREATE INDEX "TranscriptionJob_batchId_idx" ON "TranscriptionJob"("batchId");

-- AddForeignKey
ALTER TABLE "BatchJob" ADD CONSTRAINT "BatchJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TranscriptionJob" ADD CONSTRAINT "TranscriptionJob_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "BatchJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
