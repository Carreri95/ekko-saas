-- CreateEnum
CREATE TYPE "CastMemberStatus" AS ENUM ('AVAILABLE', 'BUSY', 'INACTIVE');

-- CreateTable
CREATE TABLE "CastMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "whatsapp" TEXT,
    "email" TEXT,
    "specialties" TEXT[],
    "status" "CastMemberStatus" NOT NULL DEFAULT 'AVAILABLE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CastMember_pkey" PRIMARY KEY ("id")
);
