-- AlterEnum
ALTER TYPE "CommunicationStatus" ADD VALUE 'PROCESSING';

-- AlterTable
ALTER TABLE "CommunicationLog" ADD COLUMN     "lastSendAttemptAt" TIMESTAMP(3),
ADD COLUMN     "sendAttemptCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sendLockedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "CommunicationLog_status_channel_idx" ON "CommunicationLog"("status", "channel");
