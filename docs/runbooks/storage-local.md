# Runbook — storage local (MinIO + API)

Ambiente de **desenvolvimento local** apenas. Credenciais e portas estão em `docs/architecture/storage.md`.

## Pré-requisitos

- Docker com Compose.
- `apps/api/.env` com `DATABASE_URL` (para a API; não é obrigatório só para MinIO).
- Para criar buckets e validar storage na API: variáveis `S3_*` em `apps/api/.env` (ver `.env.example`).

## 1. Subir MinIO (e Postgres, se usar o compose dev)

Na raiz do repositório:

```bash
docker compose -f infra/docker/docker-compose.dev.yml up -d
docker compose -f infra/docker/docker-compose.dev.yml ps
```

Health HTTP do MinIO (esperado: **200**):

```bash
curl -s -o NUL -w "%{http_code}" http://127.0.0.1:9000/minio/health/live
```

Consola web: `http://localhost:9001` (utilizador/palavra-passe em `docs/architecture/storage.md`).

## 2. Configurar `apps/api` para falar com MinIO

Em `apps/api/.env`, descomentar / definir pelo menos:

- `S3_ENDPOINT=http://127.0.0.1:9000` (API a correr no host)
- `S3_ACCESS_KEY` / `S3_SECRET_KEY` (no dev local, alinhadas ao MinIO do compose)
- Opcional: `S3_BUCKET_MEDIA`, `S3_BUCKET_TEMP`, `S3_REGION`, `S3_FORCE_PATH_STYLE=true`

Sem `S3_ENDPOINT`, a API trata storage como **desligado** (`GET /health/storage` → `storage: "disabled"`).

## 3. Garantir buckets iniciais (idempotente)

Buckets nesta fase (nomes por defeito; sobrescrevíveis por env):

| Variável | Valor por defeito |
|----------|-------------------|
| `S3_BUCKET_MEDIA` | `subtitlebot-media` |
| `S3_BUCKET_TEMP` | `subtitlebot-temp` |

Na pasta `apps/api`:

```bash
npm run storage:bootstrap
```

- Com storage **desligado** (sem `S3_ENDPOINT`): termina com **exit 0** e mensagem a indicar que não há nada a fazer.
- Com `S3_ENDPOINT` e credenciais: cria os buckets em falta; se já existirem, **não falha** (idempotente).

## 4. Validar `GET /health/storage`

Com a API a correr (`npm run dev:api` na raiz do monorepo ou em `apps/api`):

```bash
curl -s http://localhost:4000/health/storage
```

Esperado com MinIO configurado e acessível: HTTP **200**, corpo com `storage: "ok"` e lista `buckets` (deve incluir os dois buckets após o bootstrap).

`GET http://localhost:4000/health` continua independente de MinIO.

## 5. Resumo do fluxo típico

1. `docker compose -f infra/docker/docker-compose.dev.yml up -d`
2. Preencher `S3_*` em `apps/api/.env`
3. `cd apps/api && npm run storage:bootstrap`
4. Subir API e `curl` em `/health/storage`

## O que ainda não faz parte deste runbook

- Rotas de produto `/media` ou `/transcriptions`
- Upload real ou presigned URLs de produto
- Migração de ficheiros de `public/uploads` para o object storage

Ver fecho do Bloco 4 em `docs/migration/bloco-4.md`.
