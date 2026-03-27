-- PR 29: preferência simples de canal por dublador (CastMember)
CREATE TYPE "PreferredCommunicationChannel" AS ENUM ('EMAIL', 'WHATSAPP');

ALTER TABLE "CastMember"
ADD COLUMN "preferredCommunicationChannel" "PreferredCommunicationChannel";
