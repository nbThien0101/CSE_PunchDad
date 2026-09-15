-- AlterTable
ALTER TABLE "guest_players" ADD COLUMN IF NOT EXISTS "is_paid" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "checkout_url" TEXT,
ADD COLUMN IF NOT EXISTS "order_code" BIGINT,
ADD COLUMN IF NOT EXISTS "payment_link_id" TEXT;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "split_count" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "payments_order_code_key" ON "payments"("order_code");
