ALTER TABLE "PokerSessionUser" DROP COLUMN IF EXISTS "wallet";

ALTER TABLE "User" ALTER COLUMN "wallet" SET DEFAULT 1000;

UPDATE "User"
SET "wallet" = "chips"
WHERE "wallet" = 0 AND "chips" > 0;
