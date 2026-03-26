-- CreateEnum
CREATE TYPE "DubbingProjectStatus" AS ENUM ('SPOTTING', 'ADAPTATION', 'REVIEW', 'RECORDING', 'DELIVERY', 'DONE', 'PAUSED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('PER_PROJECT', 'PER_EPISODE', 'PER_MINUTE');

-- CreateTable
CREATE TABLE "DubbingProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "client" TEXT,
    "status" "DubbingProjectStatus" NOT NULL DEFAULT 'SPOTTING',
    "startDate" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "episodes" INTEGER,
    "durationMin" INTEGER,
    "language" TEXT,
    "value" DECIMAL(10,2),
    "paymentType" "PaymentType" NOT NULL DEFAULT 'PER_PROJECT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "DubbingProject_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DubbingProject_status_idx" ON "DubbingProject"("status");

-- CreateIndex
CREATE INDEX "DubbingProject_deadline_idx" ON "DubbingProject"("deadline");
