-- Substitui enum `valueCurrency` por coluna texto `currency` (BRL, USD, EUR).

ALTER TABLE "DubbingProject" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'BRL';

UPDATE "DubbingProject" SET "currency" = "valueCurrency"::text;

ALTER TABLE "DubbingProject" DROP COLUMN "valueCurrency";

DROP TYPE "ValueCurrency";
