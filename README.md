# SubtitleBot

Monorepo do **Subtitle Studio**: workspace para revisão e gestão de legendas, com API de domínio, interface web e worker para processamento assíncrono.

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| Web (UI + BFF) | [Next.js](https://nextjs.org/) (React) |
| API | [Fastify](https://fastify.dev/) + [Prisma](https://www.prisma.io/) |
| Worker | Node.js (jobs / transcrição) |
| Base de dados | PostgreSQL |
| Storage local (opcional) | MinIO (S3-compatible) via Docker |

---

## Pré-requisitos

- **Node.js** (LTS recomendado)
- **npm** (workspaces na raiz)
- **Docker** (para `postgres` e, opcionalmente, MinIO)

---

## Instalação

```bash
git clone <url-do-repositório>
cd SubtitleBot
npm install
```

---

## Configuração

1. Copie variáveis de ambiente conforme o que cada app espera (há `.env*` em `apps/web`, `apps/api`, `apps/worker` — ver comentários nos repositórios ou exemplos locais).
2. Na **raiz**, defina pelo menos **`DATABASE_URL`** apontando para o PostgreSQL local (ex.: `postgresql://postgres:postgres@localhost:5432/subtitle_studio?schema=public`).

Detalhes de **`API_BASE_URL`**, `OPENAI_API_KEY` e storage: **[`docs/monorepo-operacao.md`](docs/monorepo-operacao.md)**.

---

## Desenvolvimento local

Ordem recomendada na **raiz** do repositório:

```bash
# 1. Base de dados (Postgres)
npm run db:up

# 2. Migrações e seed (Prisma em apps/web)
npm run db:migrate
npm run db:seed

# 3. Três terminais (ou em background):
npm run dev:api     # API → http://localhost:4000
npm run dev:web     # Next → http://localhost:3000
npm run dev:worker  # worker de jobs
```

**Nota:** O fluxo típico do browser é `http://localhost:3000` → rotas `/api/*` no Next (**BFF**) → **forward** para `apps/api` (por defeito `http://localhost:4000`). Os contratos HTTP de negócio vivem na API.

### Infra completa (Postgres + MinIO)

Para storage S3-compatible em desenvolvimento:

```bash
npm run dev:infra
```

Consola MinIO: **http://localhost:9001** (credenciais de dev em [`docs/architecture/storage.md`](docs/architecture/storage.md)).

---

## Documentação

| Documento | Conteúdo |
|-----------|----------|
| [**`docs/monorepo-operacao.md`**](docs/monorepo-operacao.md) | **Operação do monorepo** — papéis, envs, comandos, BFF, links |
| [`docs/regras-implementacao.md`](docs/regras-implementacao.md) | Regras de engenharia e camadas (web / api / worker) |
| [`docs/runbooks/storage-local.md`](docs/runbooks/storage-local.md) | MinIO e storage local |
| [`docs/migration/`](docs/migration/) | Histórico de migração (Blocos 5–8) |

---

## Estrutura do repositório

```
apps/web       → UI Next.js + proxy BFF para a API
apps/api       → API HTTP (Fastify), Prisma de negócio
apps/worker    → Jobs assíncronos
packages/shared → Código partilhado (workspace)
infra/         → Docker Compose (dev)
docs/          → Documentação operacional e migração
```

---

## Scripts úteis (raiz)

| Comando | Descrição |
|---------|-----------|
| `npm run db:up` / `db:down` | Sobe / para Postgres (`docker-compose.yml` na raiz) |
| `npm run dev:infra` | Postgres + MinIO (`infra/docker/docker-compose.dev.yml`) |
| `npm run db:migrate` | Migrações Prisma (`apps/web`) |
| `npm run db:seed` | Seed da base |
| `npm run storage:bootstrap` | Cria buckets (API) |
| `npm run media:reconcile` | Reconciliação `MediaAsset` (API) |

---

## Contribuir

Siga as regras em [`docs/regras-implementacao.md`](docs/regras-implementacao.md): domínio HTTP em **`apps/api`**, **`apps/web`** como BFF, e **sem alterar contratos públicos** sem decisão explícita.

---

*Documentação operacional detalhada: [`docs/monorepo-operacao.md`](docs/monorepo-operacao.md).*
