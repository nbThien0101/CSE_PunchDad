-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "organizer_ids" JSONB NOT NULL DEFAULT '[]',
    "state" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notices" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "tournament_id" TEXT,
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_reads" (
    "notice_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "read_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notice_reads_pkey" PRIMARY KEY ("notice_id","user_id")
);

-- CreateIndex
CREATE INDEX "tournaments_created_at_idx" ON "tournaments"("created_at");

-- CreateIndex
CREATE INDEX "notices_archived_at_created_at_idx" ON "notices"("archived_at", "created_at");

-- CreateIndex
CREATE INDEX "notice_reads_user_id_idx" ON "notice_reads"("user_id");

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_reads" ADD CONSTRAINT "notice_reads_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "notices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_reads" ADD CONSTRAINT "notice_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
