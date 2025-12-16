-- DropIndex
DROP INDEX "public"."PokerSession_sessionCode_key";

-- AlterTable
ALTER TABLE "PokerSession" ALTER COLUMN "sessionCode" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "developer" BOOLEAN NOT NULL DEFAULT false;
