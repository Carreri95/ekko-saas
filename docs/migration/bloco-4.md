# Bloco 4 — fundação de storage real (desenvolvimento local)

## Objetivo

Preparar **storage S3-compatible** em desenvolvimento local com **MinIO**, documentação e variáveis de ambiente, **sem** alterar o comportamento do produto nem acoplar rotas HTTP a MinIO nesta fase.

## PR 4.1 — o que entrou

- Serviço **MinIO** no `infra/docker/docker-compose.dev.yml` (API S3 + consola web).
- Exemplos de env para **`apps/api`** (e referência em `infra/env/api.env.example`) com variáveis `S3_*` **documentadas**; o runtime da API **não** as utiliza ainda.
- Este ficheiro (`bloco-4.md`) e `docs/architecture/storage.md` (buckets, keys, portas, credenciais dev, limites do bloco).

## PR 4.2 — o que entrou

- Dependência `@aws-sdk/client-s3` em `apps/api`.
- Infraestrutura em `apps/api/src/infrastructure/storage/`:
  - `storage-config.ts` — leitura de `S3_*` (desligado se `S3_ENDPOINT` ausente).
  - `s3-client.ts` — fábrica de `S3Client` (MinIO-compatible).
  - `storage-health.service.ts` — `ListBuckets` para validar credenciais/rede.
- Rota operacional **`GET /health/storage`** (diagnóstico; **não** usada pelo frontend de produto).
- `GET /health` mantém-se `{ ok: true, service: "api" }` e **não** depende de MinIO.

## PR 4.3 — o que entrou

- Modelo Prisma **`MediaAsset`** em `apps/api/prisma/schema.prisma` (registo canónico de ficheiros em object storage).
- Enums **`MediaAssetKind`**, **`MediaAssetStatus`**, **`MediaVisibility`**.
- Migration **`20260323130000_add_media_asset`** em `apps/api/prisma/migrations/` (tabela `MediaAsset`; índices e `@@unique` em `bucket` + `objectKey`).
- `prisma.config.ts` em `apps/api` (Prisma 7: `DATABASE_URL` e pasta de migrations; carrega `.env` via `dotenv`).
- **Sem** rotas `/media`, **sem** upload real, **sem** presigned URLs, **sem** integração com MinIO em fluxos de negócio e **sem** uso no frontend.

## PR 4.4 — o que entrou (fecho do Bloco 4)

- **`ensureStorageBuckets()`** em `apps/api/src/infrastructure/storage/ensure-buckets.ts` — criação idempotente dos buckets (`HeadBucket` + `CreateBucket` com tratamento de conflito).
- Script **`npm run storage:bootstrap`** (`src/scripts/bootstrap-storage-buckets.ts`): usa `loadStorageConfig()` e `createS3Client()`; sem `S3_ENDPOINT` termina com exit **0** (nada a fazer).
- Runbook **`docs/runbooks/storage-local.md`**: subir MinIO, envs, bootstrap, `GET /health/storage`.
- **`docs/architecture/storage.md`** atualizado (tabela de ficheiros + ligação ao runbook).

## Bloco 4 — formalmente encerrado

Com o PR 4.4, o Bloco 4 fica **fechado** no âmbito definido: infra local reproduzível (compose + envs + health + buckets + modelo `MediaAsset` em BD), **sem** alterar rotas de produto nem upload legado.

## Próximos passos (fora do âmbito do Bloco 4)

- Migração de `POST .../media` e `POST .../transcriptions` para a API.
- Upload real via presigned URL e ligação de `MediaAsset` a fluxos de produto.
- **Worker** funcional e migração de ficheiros de `public/uploads` para object storage.

## O que permanece explicitamente fora (pós-Bloco 4)

- Uso de MinIO em rotas de produto (`/media`, `/transcriptions`, etc.) — ainda não implementado.
- Alteração de comportamento do frontend ou das rotas já existentes para consumir storage — ainda não feita.

## Critério de pronto (PR 4.1)

- `docker compose -f infra/docker/docker-compose.dev.yml up -d` sobe **Postgres** e **MinIO**.
- Variáveis de storage estão documentadas nos `.env.example`.
- Documentação de arquitetura de storage existe e está alinhada com o compose.
- O produto continua a funcionar como antes (upload local em Next, etc.).

## Validação rápida (local)

```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d
docker compose -f infra/docker/docker-compose.dev.yml ps
curl -s -o NUL -w "%{http_code}" http://127.0.0.1:9000/minio/health/live
```

Esperado: serviços `postgres` e `minio` em execução; código HTTP **200** no health do MinIO.

Consola: `http://localhost:9001` (utilizador/palavra-passe em `docs/architecture/storage.md`).

## Validação PR 4.2 (storage na API)

1. Sem variáveis `S3_*` em `apps/api/.env`: `GET http://localhost:4000/health/storage` → **200**, corpo com `storage: "disabled"`.
2. MinIO a correr + `.env` com `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` (e opcionalmente resto): `GET http://localhost:4000/health/storage` → **200**, `storage: "ok"`, `buckets` (após `npm run storage:bootstrap` devem aparecer os buckets configurados; antes disso a lista pode estar vazia).
3. `GET http://localhost:4000/health` continua **sem** depender de MinIO.

## Validação PR 4.3 (MediaAsset no Prisma)

1. Postgres acessível com `DATABASE_URL` em `apps/api/.env`.
2. `npm run db:generate --prefix apps/api` — gera cliente sem erros (inclui `mediaAsset` no delegate).
3. `npm run db:deploy --prefix apps/api` — aplica migration `20260323130000_add_media_asset` (idempotente se já aplicada).
4. Opcional: `npx prisma studio --config prisma.config.ts` em `apps/api` e confirmar tabela **`MediaAsset`**.
5. Rotas de produto existentes **não** referenciam `MediaAsset` (verificação por código).

## Validação PR 4.4 (bootstrap de buckets + runbook)

1. MinIO a correr (`docker compose -f infra/docker/docker-compose.dev.yml up -d`).
2. `apps/api/.env` com `S3_ENDPOINT`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` (e opcionalmente `S3_BUCKET_*`).
3. `cd apps/api && npm run storage:bootstrap` — exit **0**; buckets criados ou já existentes (repetir o comando não deve falhar).
4. `curl -s http://localhost:4000/health/storage` com API a correr — **200**, `storage: "ok"`, lista de `buckets` inclui `subtitlebot-media` e `subtitlebot-temp` (ou os nomes definidos em env).
5. Sem `S3_ENDPOINT`: `npm run storage:bootstrap` — exit **0**, mensagem a indicar storage desligado.

## Regra operacional

- Schema Prisma oficial do backend continua em `apps/api/prisma/schema.prisma` até decisão explícita de novos modelos.
- Operação local de storage (MinIO, buckets, health): ver **`docs/runbooks/storage-local.md`**.
