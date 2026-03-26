import "dotenv/config";

import bcrypt from "bcryptjs";

import { prisma } from "../src/lib/prisma";
import { isDatabaseConnectionError } from "../src/server/prisma-errors";

/** Alinhado com `apps/api/src/infrastructure/demo-user.ts` — utilizador por defeito para fluxos dev (ex.: `POST /api/projects`). */
const DEMO_EMAIL = "demo@subtitlestudio.local";
const DEMO_NAME = "Demo User";
const DEMO_PASSWORD = "dev-fake-password";

async function main() {
  const passwordHash = bcrypt.hashSync(DEMO_PASSWORD, 10);

  await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {
      name: DEMO_NAME,
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
    create: {
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  });
}

main()
  .catch((e) => {
    if (isDatabaseConnectionError(e)) {
      // eslint-disable-next-line no-console
      console.error(`
[seed] Não foi possível ligar ao PostgreSQL.
- Na raiz do repositório: docker compose up -d
- Em web/: copie .env.example para .env e confira DATABASE_URL
- Depois: npm run db:migrate (ou db:deploy) e volte a executar o seed.
`);
    }
    // eslint-disable-next-line no-console
    console.error("Falha ao executar seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

