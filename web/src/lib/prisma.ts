import { PrismaClient } from "../../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Evita criar múltiplas instâncias do PrismaClient durante hot reload no dev.
// (Em prod, não faz cache no global.)
const globalForPrisma = globalThis as unknown as { prismaClient?: PrismaClient };

function newPrismaClient(): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    log: ["error"],
  });
}

let cached = globalForPrisma.prismaClient;
// Hot reload pode manter um singleton gerado antes de `prisma generate` (ex.: sem `batchJob`).
if (
  cached &&
  typeof (cached as unknown as { batchJob?: unknown }).batchJob === "undefined"
) {
  globalForPrisma.prismaClient = undefined;
  cached = undefined;
}

export const prisma = cached ?? newPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prismaClient = prisma;
}

