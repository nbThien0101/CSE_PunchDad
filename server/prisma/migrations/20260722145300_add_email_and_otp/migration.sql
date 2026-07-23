-- AlterTable: Add email column to users
ALTER TABLE "users" ADD COLUMN "email" TEXT;

-- CreateIndex: Unique constraint on email
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateTable: OTP Verifications
CREATE TABLE "otp_verifications" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_verifications_pkey" PRIMARY KEY ("id")
);
