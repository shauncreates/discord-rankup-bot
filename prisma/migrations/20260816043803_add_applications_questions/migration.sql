-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'PROMOTED', 'DENIED');

-- AlterTable
ALTER TABLE "Guild" ADD COLUMN     "reapplyCooldownHours" INTEGER NOT NULL DEFAULT 24;

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "threadId" TEXT,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "answers" JSONB NOT NULL,
    "assignedRankLabel" TEXT,
    "reviewerId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Question_guildId_idx" ON "Question"("guildId");

-- CreateIndex
CREATE INDEX "Application_guildId_idx" ON "Application"("guildId");

-- CreateIndex
CREATE INDEX "Application_guildId_applicantId_idx" ON "Application"("guildId", "applicantId");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
