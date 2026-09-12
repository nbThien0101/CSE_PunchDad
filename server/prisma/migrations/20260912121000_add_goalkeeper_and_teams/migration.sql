-- AlterTable
ALTER TABLE "users" ADD COLUMN "is_goalkeeper" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN "teams" JSONB;
