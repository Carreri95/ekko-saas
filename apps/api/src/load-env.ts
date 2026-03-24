/**
 * Carrega `apps/api/.env` antes de Prisma e restantes módulos.
 * Caminho fixo relativamente a este ficheiro (funciona com `npm run` na raiz do monorepo).
 */
import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
config({ path: join(here, "../.env") });
