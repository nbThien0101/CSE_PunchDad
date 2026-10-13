CREATE TYPE "MembershipStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Existing club members keep access. Only new accounts need approval.
ALTER TABLE "users"
ADD COLUMN "membership_status" "MembershipStatus" NOT NULL DEFAULT 'APPROVED',
ADD COLUMN "membership_reviewed_at" TIMESTAMP(3),
ADD COLUMN "membership_reviewed_by" TEXT;

ALTER TABLE "users" ALTER COLUMN "membership_status" SET DEFAULT 'PENDING';
CREATE INDEX "users_membership_status_created_at_idx" ON "users"("membership_status", "created_at");
