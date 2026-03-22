-- CreateEnum
CREATE TYPE "ValueCurrency" AS ENUM ('BRL', 'USD');

-- AlterTable
ALTER TABLE "DubbingProject" ADD COLUMN     "valueCurrency" "ValueCurrency" NOT NULL DEFAULT 'BRL';
