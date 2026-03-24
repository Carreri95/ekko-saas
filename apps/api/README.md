# apps/api

Placeholder formal para a aplicacao de backend dedicada.

Escopo neste Bloco 1:
- Criar a espinha dorsal do monorepo.
- Nao extrair ainda `app/api/*` de `apps/web`.

Extracao real comeca no Bloco 2.

Nota operacional (Bloco 2):
- Defina `DATABASE_URL` em `apps/api/.env` (base em `.env.example`).
- Gere o client Prisma com: `npm run db:generate --prefix apps/api`.
