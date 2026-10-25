-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "account_name" TEXT,
ADD COLUMN     "account_number" TEXT,
ADD COLUMN     "bin" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "qr_code" TEXT;
