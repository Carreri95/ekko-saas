import "dotenv/config";

import { prisma } from "../src/lib/prisma";

const DEMO_EMAIL = "demo@subtitlestudio.local";
const DEMO_NAME = "Demo User";
const DEMO_PASSWORD = "dev-fake-password";

async function main() {
  await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {
      name: DEMO_NAME,
      password: DEMO_PASSWORD,
    },
    create: {
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      password: DEMO_PASSWORD,
    },
  });
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error("Falha ao executar seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

