ALTER TABLE "users" ADD COLUMN "auth_version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "otp_verifications" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;

-- Discard proofs issued before the OTP validation fix.
UPDATE "otp_verifications" SET "used" = true WHERE "used" = false;
