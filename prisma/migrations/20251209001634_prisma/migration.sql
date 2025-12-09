/*
  Warnings:

  - Added the required column `sessionCode` to the `PokerSession` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "PokerSession" ADD COLUMN     "sessionCode" INTEGER NOT NULL;
