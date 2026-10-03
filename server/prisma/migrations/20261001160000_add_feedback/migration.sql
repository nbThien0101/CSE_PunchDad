CREATE TABLE "feedbacks" (
    "id" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "rating" INTEGER,
    "message" TEXT NOT NULL,
    "page_path" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "admin_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "feedbacks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "feedbacks_status_created_at_idx" ON "feedbacks"("status", "created_at");
CREATE INDEX "feedbacks_user_id_idx" ON "feedbacks"("user_id");

ALTER TABLE "feedbacks"
ADD CONSTRAINT "feedbacks_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
