-- AlterTable
ALTER TABLE "CommunicationLog" ADD COLUMN "communicationGroupId" TEXT;

-- CreateIndex
CREATE INDEX "CommunicationLog_communicationGroupId_idx" ON "CommunicationLog"("communicationGroupId");
