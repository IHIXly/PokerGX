-- DropIndex
DROP INDEX "public"."PokerSession_sessionCode_key";

-- AlterTable
ALTER TABLE "PokerSession" ALTER COLUMN "sessionCode" SET DEFAULT 0;
