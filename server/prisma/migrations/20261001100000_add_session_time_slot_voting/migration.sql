ALTER TABLE "sessions" ADD COLUMN "selected_time_slot_id" TEXT;

CREATE TABLE "session_time_slots" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "session_time_slots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "time_slot_votes" (
    "id" TEXT NOT NULL,
    "vote_id" TEXT NOT NULL,
    "time_slot_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "time_slot_votes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "session_time_slots_session_id_start_time_end_time_key"
ON "session_time_slots"("session_id", "start_time", "end_time");

CREATE UNIQUE INDEX "time_slot_votes_vote_id_time_slot_id_key"
ON "time_slot_votes"("vote_id", "time_slot_id");

ALTER TABLE "session_time_slots"
ADD CONSTRAINT "session_time_slots_session_id_fkey"
FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "time_slot_votes"
ADD CONSTRAINT "time_slot_votes_vote_id_fkey"
FOREIGN KEY ("vote_id") REFERENCES "votes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "time_slot_votes"
ADD CONSTRAINT "time_slot_votes_time_slot_id_fkey"
FOREIGN KEY ("time_slot_id") REFERENCES "session_time_slots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve existing matches as single-option matches.
INSERT INTO "session_time_slots" ("id", "session_id", "start_time", "end_time")
SELECT gen_random_uuid()::text, "id", "start_time", "end_time" FROM "sessions";

UPDATE "sessions" s
SET "selected_time_slot_id" = t."id"
FROM "session_time_slots" t
WHERE t."session_id" = s."id";
