-- Reverte coluna texto `currency` para enum `valueCurrency` (BRL | USD).

CREATE TYPE "ValueCurrency" AS ENUM ('BRL', 'USD');

ALTER TABLE "DubbingProject" ADD COLUMN "valueCurrency" "ValueCurrency" NOT NULL DEFAULT 'BRL';

UPDATE "DubbingProject" SET "valueCurrency" = CASE
  WHEN "currency" = 'USD' THEN 'USD'::"ValueCurrency"
  ELSE 'BRL'::"ValueCurrency"
END;

ALTER TABLE "DubbingProject" DROP COLUMN "currency";
