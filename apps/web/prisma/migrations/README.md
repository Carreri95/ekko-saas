# Migrations movidas para `apps/api`

As migrações Prisma vivem apenas em **`apps/api/prisma/migrations`**.

Use na raiz do monorepo:

- `npm run db:migrate` — `prisma migrate dev` em `apps/api`
- `npm run db:deploy` — `prisma migrate deploy` em `apps/api`
- `npm run db:generate` — gera client em `apps/api` e em `apps/web` (generator `client_web` no schema da API)

Não adicionar novas pastas de migração aqui.
