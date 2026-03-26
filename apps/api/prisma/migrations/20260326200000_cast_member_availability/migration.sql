-- CreateEnum
CREATE TYPE "CastMemberAvailabilityType" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'BLOCKED');

-- CreateTable
CREATE TABLE "CastMemberAvailability" (
    "id" TEXT NOT NULL,
    "castMemberId" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "type" "CastMemberAvailabilityType" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CastMemberAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CastMemberAvailability_castMemberId_idx" ON "CastMemberAvailability"("castMemberId");

CREATE INDEX "CastMemberAvailability_castMemberId_startAt_idx" ON "CastMemberAvailability"("castMemberId", "startAt");

-- AddForeignKey
ALTER TABLE "CastMemberAvailability" ADD CONSTRAINT "CastMemberAvailability_castMemberId_fkey" FOREIGN KEY ("castMemberId") REFERENCES "CastMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
