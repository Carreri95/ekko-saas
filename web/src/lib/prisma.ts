import { PrismaClient } from "../../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Incrementar após `prisma migrate` / mudanças no schema que alterem o client,
 * para não reutilizar um PrismaClient antigo em memória (HMR) com modelo incompatível.
 */
const PRISMA_CLIENT_REVISION = "20260323-restore-value-currency";

// Evita criar múltiplas instâncias do PrismaClient durante hot reload no dev.
// (Em prod, não faz cache no global.)
const globalForPrisma = globalThis as unknown as {
  prismaClient?: PrismaClient;
  prismaClientRevision?: string;
};

function newPrismaClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    log: ["error"],
  });
}

let cached = globalForPrisma.prismaClient;
if (
  cached &&
  globalForPrisma.prismaClientRevision !== PRISMA_CLIENT_REVISION
) {
  globalForPrisma.prismaClient = undefined;
  cached = undefined;
}

export const prisma = cached ?? newPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaClient = prisma;
  globalForPrisma.prismaClientRevision = PRISMA_CLIENT_REVISION;
}

