-- AlterTable
ALTER TABLE "CommunicationLog" ADD COLUMN     "nextRetryAt" TIMESTAMP(3),
ADD COLUMN     "providerMessageId" TEXT;

-- CreateIndex
CREATE INDEX "CommunicationLog_status_channel_nextRetryAt_idx" ON "CommunicationLog"("status", "channel", "nextRetryAt");
