import { prisma } from "./db/prisma.client.js";

/** Alinhado com `apps/web/prisma/seed.ts` — utilizador `demo@subtitlestudio.local` (role ADMIN após seed de auth). */
const DEMO_EMAIL = "demo@subtitlestudio.local";

/** Resolve o utilizador demo criado por `npm run db:seed` / `npm run seed`. */
export async function getDefaultUserId(): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: { email: DEMO_EMAIL },
    select: { id: true },
  });
  return user?.id ?? null;
}
