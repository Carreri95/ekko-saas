-- CreateEnum
CREATE TYPE "ProjectCharacterAssignmentType" AS ENUM ('TEST_OPTION_1', 'TEST_OPTION_2', 'PRINCIPAL', 'RESERVE', 'SUPPORT');

-- CreateEnum
CREATE TYPE "ProjectCharacterAssignmentStatus" AS ENUM ('INVITED', 'TEST_SENT', 'TEST_RECEIVED', 'APPROVED', 'CAST', 'REPLACED', 'DECLINED');

-- CreateTable
CREATE TABLE "ProjectCharacterAssignment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "castMemberId" TEXT NOT NULL,
    "type" "ProjectCharacterAssignmentType" NOT NULL,
    "status" "ProjectCharacterAssignmentStatus" NOT NULL DEFAULT 'INVITED',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "approvedByClient" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectCharacterAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectCharacterAssignment_projectId_idx" ON "ProjectCharacterAssignment"("projectId");

-- CreateIndex
CREATE INDEX "ProjectCharacterAssignment_characterId_idx" ON "ProjectCharacterAssignment"("characterId");

-- CreateIndex
CREATE INDEX "ProjectCharacterAssignment_castMemberId_idx" ON "ProjectCharacterAssignment"("castMemberId");

-- CreateIndex
CREATE INDEX "ProjectCharacterAssignment_projectId_characterId_idx" ON "ProjectCharacterAssignment"("projectId", "characterId");

-- CreateIndex
CREATE INDEX "ProjectCharacterAssignment_projectId_castMemberId_idx" ON "ProjectCharacterAssignment"("projectId", "castMemberId");

-- CreateIndex
CREATE INDEX "ProjectCharacterAssignment_type_status_idx" ON "ProjectCharacterAssignment"("type", "status");

-- AddForeignKey
ALTER TABLE "ProjectCharacterAssignment" ADD CONSTRAINT "ProjectCharacterAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "DubbingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCharacterAssignment" ADD CONSTRAINT "ProjectCharacterAssignment_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "ProjectCharacter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectCharacterAssignment" ADD CONSTRAINT "ProjectCharacterAssignment_castMemberId_fkey" FOREIGN KEY ("castMemberId") REFERENCES "CastMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
