-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "SubtitleSourceType" AS ENUM ('UPLOADED_SRT', 'IMPORTED_BUZZ', 'IMPORTED_WHISPER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubtitleFile" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "language" TEXT,
    "sourceType" "SubtitleSourceType" NOT NULL DEFAULT 'UPLOADED_SRT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "SubtitleFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubtitleCue" (
    "id" TEXT NOT NULL,
    "cueIndex" INTEGER NOT NULL,
    "startMs" INTEGER NOT NULL,
    "endMs" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "subtitleFileId" TEXT NOT NULL,

    CONSTRAINT "SubtitleCue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubtitleVersion" (
    "id" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "label" TEXT,
    "srtContent" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtitleFileId" TEXT NOT NULL,

    CONSTRAINT "SubtitleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "SubtitleCue_subtitleFileId_cueIndex_idx" ON "SubtitleCue"("subtitleFileId", "cueIndex");

-- CreateIndex
CREATE UNIQUE INDEX "SubtitleVersion_subtitleFileId_versionNumber_key" ON "SubtitleVersion"("subtitleFileId", "versionNumber");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubtitleFile" ADD CONSTRAINT "SubtitleFile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubtitleCue" ADD CONSTRAINT "SubtitleCue_subtitleFileId_fkey" FOREIGN KEY ("subtitleFileId") REFERENCES "SubtitleFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubtitleVersion" ADD CONSTRAINT "SubtitleVersion_subtitleFileId_fkey" FOREIGN KEY ("subtitleFileId") REFERENCES "SubtitleFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
