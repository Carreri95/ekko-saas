-- PR 29B: modulo de colaboradores
CREATE TYPE "CollaboratorRole" AS ENUM (
  'RECORDING_TECHNICIAN',
  'POST_PRODUCTION',
  'MIXER',
  'PRE_PRODUCTION'
);

CREATE TABLE "Collaborator" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "cpf" TEXT,
  "cnpj" TEXT,
  "razaoSocial" TEXT,
  "role" "CollaboratorRole" NOT NULL,
  "email" TEXT,
  "whatsapp" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Collaborator_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Collaborator_email_key" ON "Collaborator"("email");
CREATE UNIQUE INDEX "Collaborator_whatsapp_key" ON "Collaborator"("whatsapp");
