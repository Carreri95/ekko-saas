import { prisma } from "../lib/prisma";

/** Alinhado com `prisma/seed.ts` — tem de existir na BD antes de `POST /api/projects`. */
const DEMO_EMAIL = "demo@subtitlestudio.local";

/** Resolve o utilizador demo criado por `npm run db:seed` / `npm run seed`. */
export async function getDefaultUserId(): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: { email: DEMO_EMAIL },
    select: { id: true },
  });
  return user?.id ?? null;
}
