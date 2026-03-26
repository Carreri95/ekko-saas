import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";

const PRISMA_CLIENT_REVISION = "api-prisma-bootstrap-v1";

const globalForPrisma = globalThis as unknown as {
  prismaClient?: PrismaClient;
  prismaClientRevision?: string;
};

function newPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL nao definido para apps/api.");
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
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
