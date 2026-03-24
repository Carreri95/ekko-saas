-- CreateEnum
CREATE TYPE "CharacterImportance" AS ENUM ('MAIN', 'SUPPORT', 'EXTRA');

-- CreateTable
CREATE TABLE "ProjectCharacter" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT,
    "voiceType" TEXT,
    "importance" "CharacterImportance" NOT NULL DEFAULT 'SUPPORT',
    "castMemberId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectCharacter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectCharacter_projectId_idx" ON "ProjectCharacter"("projectId");

-- AddForeignKey
ALTER TABLE "ProjectCharacter" ADD CONSTRAINT "ProjectCharacter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "DubbingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCharacter" ADD CONSTRAINT "ProjectCharacter_castMemberId_fkey" FOREIGN KEY ("castMemberId") REFERENCES "CastMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
