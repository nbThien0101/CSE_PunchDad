-- AlterTable
ALTER TABLE "sessions" ADD COLUMN "is_vote_locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "vote_locked_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "votes" ADD COLUMN "is_checked_in" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "checked_in_at" TIMESTAMP(3),
ADD COLUMN "check_in_note" TEXT;

-- CreateTable
CREATE TABLE "absence_logs" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reason" TEXT,
    "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_late" BOOLEAN NOT NULL DEFAULT false,
    "minutes_before_match" INTEGER,

    CONSTRAINT "absence_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "guest_players" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "tier" TEXT DEFAULT 'C',
    "is_goalkeeper" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'RESERVE',
    "is_checked_in" BOOLEAN NOT NULL DEFAULT false,
    "checked_in_at" TIMESTAMP(3),
    "note" TEXT,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guest_players_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "absence_logs" ADD CONSTRAINT "absence_logs_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "absence_logs" ADD CONSTRAINT "absence_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guest_players" ADD CONSTRAINT "guest_players_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
