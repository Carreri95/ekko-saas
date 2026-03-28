-- PR 29A: dados fiscais em pessoas (dubladores)
ALTER TABLE "CastMember"
ADD COLUMN "cpf" TEXT,
ADD COLUMN "cnpj" TEXT,
ADD COLUMN "razaoSocial" TEXT;
