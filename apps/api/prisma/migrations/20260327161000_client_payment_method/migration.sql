-- PR 29C: metodo de pagamento no cliente
CREATE TYPE "ClientPaymentMethod" AS ENUM ('WIRE_TRANSFER', 'WISE');

ALTER TABLE "Client"
ADD COLUMN "paymentMethod" "ClientPaymentMethod";
