-- CreateEnum
CREATE TYPE "InviteEmailDispatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "InviteEmailDispatch" (
    "id" TEXT NOT NULL,
    "inviteId" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "inviteUrl" TEXT,
    "status" "InviteEmailDispatchStatus" NOT NULL DEFAULT 'PENDING',
    "lastError" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InviteEmailDispatch_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InviteEmailDispatch_inviteId_key" ON "InviteEmailDispatch"("inviteId");

CREATE INDEX "InviteEmailDispatch_status_createdAt_idx" ON "InviteEmailDispatch"("status", "createdAt");

ALTER TABLE "InviteEmailDispatch" ADD CONSTRAINT "InviteEmailDispatch_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "Invite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
