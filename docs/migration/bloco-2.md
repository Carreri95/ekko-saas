# Bloco 2 - separacao inicial de backend

## PR 2.1 - bootstrap funcional de apps/api

Escopo deste PR:
- Criar servidor HTTP minimo em `apps/api`.
- Expor `GET /health` com resposta 200.
- Ler `API_PORT` com default 4000.
- Tornar `dev:api` funcional na raiz.

Fora de escopo neste PR:
- Prisma no `apps/api`.
- Migracao de endpoints de dominio.
- Proxy/forward em `apps/web`.
- Worker, MinIO, MediaAsset, transcription pesada.

## PR 2.2 - prisma base no apps/api

Escopo deste PR:
- Definir `apps/api/prisma/schema.prisma` como local oficial do schema no backend novo (nesta fase).
- Adicionar scripts Prisma em `apps/api` (`db:generate`, `db:migrate`, `db:deploy`, `db:studio`). Em Prisma 7, os comandos usam `prisma.config.ts` (ver `apps/api/prisma.config.ts`).
- Criar infraestrutura minima de client singleton em `apps/api/src/infrastructure/db/prisma.client.ts`.
- Definir `DATABASE_URL` no `apps/api/.env.example`.

Fora de escopo neste PR:
- Migracao de endpoints de dominio para `apps/api`.
- Alteracao de comportamento do `apps/web`.
- Worker, MinIO, MediaAsset, transcription pesada.

Regra operacional desta fase:
- O schema oficial do backend novo e `apps/api/prisma/schema.prisma`.

## PR 2.3 - clients como primeiro dominio migrado

Escopo deste PR:
- Migrar o dominio `clients` para `apps/api` com endpoints:
  - `GET /api/clients`
  - `POST /api/clients`
  - `GET /api/clients/:id`
  - `PATCH /api/clients/:id`
  - `DELETE /api/clients/:id`
- Usar Prisma de `apps/api` no modulo `clients`.
- Manter compatibilidade temporaria em `apps/web/app/api/clients/*` via forward para `apps/api`.

Fora de escopo neste PR:
- Migracao de `cast-members` e `dubbing-projects`.
- Migracao de transcription pesada, worker, MinIO e MediaAsset.

## PR 2.4 - cast-members como segundo dominio migrado

Escopo deste PR:
- Migrar o dominio `cast-members` para `apps/api`, incluindo:
  - `GET /api/cast-members`
  - `POST /api/cast-members`
  - `GET /api/cast-members/:id`
  - `PATCH /api/cast-members/:id`
  - `DELETE /api/cast-members/:id`
  - `GET /api/cast-members/:id/castings`
- Usar Prisma de `apps/api` no modulo `cast-members`.
- Manter compatibilidade temporaria em `apps/web/app/api/cast-members/*` via forward para `apps/api`.

Fora de escopo neste PR:
- Migracao de `dubbing-projects`.
- Migracao de transcription pesada, worker, MinIO e MediaAsset.

## PR 2.5 - dubbing-projects como terceiro dominio migrado

Escopo deste PR:
- Migrar o dominio `dubbing-projects` para `apps/api`, incluindo:
  - `GET /api/dubbing-projects`
  - `POST /api/dubbing-projects`
  - `GET /api/dubbing-projects/:id`
  - `PATCH /api/dubbing-projects/:id`
  - `DELETE /api/dubbing-projects/:id`
  - `GET /api/dubbing-projects/:id/characters`
  - `POST /api/dubbing-projects/:id/characters`
  - `PATCH /api/dubbing-projects/:id/characters/:charId`
  - `DELETE /api/dubbing-projects/:id/characters/:charId`
- Usar Prisma de `apps/api` no modulo `dubbing-projects`.
- Manter compatibilidade temporaria em `apps/web/app/api/dubbing-projects/*` via forward para `apps/api`.

Fora de escopo neste PR:
- Migracao de transcription pesada, worker, MinIO e MediaAsset.

## Fechamento formal do Bloco 2

Status: **concluido**.

Objetivo atingido neste bloco:
- Extracao inicial de backend para `apps/api` sem quebrar o frontend atual.
- Prisma oficializado no backend novo.
- Compatibilidade temporaria mantida no `apps/web` via forward/proxy.

Dominios ja migrados para `apps/api`:
- `clients`
- `cast-members`
- `dubbing-projects`

Rotas que ja estao no backend novo (`apps/api`):
- `GET/POST /api/clients`
- `GET/PATCH/DELETE /api/clients/:id`
- `GET/POST /api/cast-members`
- `GET/PATCH/DELETE /api/cast-members/:id`
- `GET /api/cast-members/:id/castings`
- `GET/POST /api/dubbing-projects`
- `GET/PATCH/DELETE /api/dubbing-projects/:id`
- `GET/POST /api/dubbing-projects/:id/characters`
- `PATCH/DELETE /api/dubbing-projects/:id/characters/:charId`

Rotas que **ainda permanecem** em `apps/web/app/api/*` (nao migradas neste bloco):
- `batch-jobs/*`
- `cues/*`
- `jobs/*`
- `projects/*`
- `subtitle-cues/*`
- `subtitle-files/*`

Estrategia temporaria de compatibilidade (forward/proxy):
- As rotas migradas continuam expostas no `apps/web` para manter contrato publico estavel.
- O handler em `apps/web/app/api/...` apenas encaminha request/response para `apps/api`.
- O `apps/web` segue funcional sem mudanca de comportamento do frontend.
- A remocao desses forwards fica para bloco posterior, apos migracao total dos dominios alvo.

Regra operacional do schema Prisma nesta fase:
- O schema oficial do backend novo e `apps/api/prisma/schema.prisma`.
- Scripts Prisma da fase devem usar explicitamente esse caminho.

Modo padrao para subir ambiente local (fase atual):
- API: `npm run dev:api` -> esperado em `http://localhost:4000`
- Web: `npm run dev` -> esperado em `http://localhost:3000`
- Fluxo esperado: frontend no web consumindo rotas migradas via forward para a API nova.

Riscos pendentes (fora do escopo do Bloco 2):
- Erros de TypeScript/build pre-existentes em partes ainda nao saneadas.
- Modulos ainda nao migrados permanecem acoplados ao `apps/web/app/api/*`.
- Transcription pesada continua no `apps/web` (ainda sem extracao para `apps/worker`).

Proximo passo recomendado (inicio do Bloco 3):
- Migrar o dominio tecnico de `projects` (core de editor/transcription leve) para `apps/api` com compatibilidade temporaria no `apps/web`.
- Manter sem worker real, sem MinIO e sem MediaAsset neste primeiro passo do proximo bloco.
