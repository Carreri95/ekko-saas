// Schema e migrations canónicos: apps/api (ENGINEERING-RULES §18.2). Generate: `npm run db:generate` na raiz.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "../api/prisma/schema.prisma",
  migrations: {
    path: "../api/prisma/migrations",
    /** Necessário para `POST /api/projects` (utilizador demo). Ver `npm run db:seed`. */
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
