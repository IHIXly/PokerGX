/*
  Warnings:

  - A unique constraint covering the columns `[sessionCode]` on the table `PokerSession` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "PokerSession" ALTER COLUMN "sessionCode" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "PokerSession_sessionCode_key" ON "PokerSession"("sessionCode");
