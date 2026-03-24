# Operação do monorepo SubtitleBot

**Estado:** documento âncora após reorganização principal (Blocos 5–8). **Última actualização:** 2026-03.

Este ficheiro resume **como correr** o stack e **onde está a lógica** — sem substituir os `docs/migration/bloco-*.md` (histórico e decisões por PR).

---

## Papel de cada parte

| Componente | Papel |
|------------|--------|
| **`apps/web`** | UI Next.js + **BFF**: rotas em `app/api/**` **encaminham** pedidos para `apps/api` (`forward-to-api.ts`: JSON, binário, multipart). **Não** é o dono da lógica de domínio HTTP. |
| **`apps/api`** | **API HTTP** (Fastify): rotas, validação, Prisma, integrações (storage, jobs expostos via HTTP). **Verdade** dos contratos `/api/...` usados pelo browser via Next. |
| **`apps/worker`** | Processos **assíncronos** (ex.: transcrição, claim de jobs `PENDING`): lê a BD, não substitui a API para o fluxo síncrono do editor. |
| **`packages/shared`** | Pacote workspace **`@subtitlebot/shared`** — ponto de partida para tipos/código partilhado; hoje majoritariamente **placeholder** (`src/index.ts` vazio export). O pacote **`subtitlebot`** na **raiz** do repo é referenciado por `apps/api` (`file:../..`) para workspace. |
| **`infra/`** | Docker Compose e notas de **infra local** (Postgres, MinIO em dev). |

**Fluxo típico (browser → dados):** Browser → `apps/web` (porta 3000) → proxy `/api/*` → `apps/api` (porta 4000) → PostgreSQL (+ storage local / MinIO conforme ambiente).

---

## Variáveis de ambiente (mínimo útil)

| Variável | Onde | Função |
|----------|------|--------|
| **`DATABASE_URL`** | Raiz `.env` (e consumo em `apps/api`, `apps/web` Prisma, `apps/worker`) | Ligação PostgreSQL. Ex.: `postgresql://postgres:postgres@localhost:5432/subtitle_studio?schema=public` |
| **`API_BASE_URL`** | `apps/web` (opcional em dev) | Base URL da API para o BFF; **omissão:** `http://localhost:4000` em `forward-to-api.ts`. |
| **`OPENAI_API_KEY`** / **`x-openai-key`** | Conforme rotas | Transcrição / fluxos que precisam de chave OpenAI (repasse no forward quando aplicável). |

Outros ficheiros `.env` ou `MAX_FILE_SIZE_MB` no Next: ver `apps/web/next.config.ts` e comentários junto a uploads.

---

## Subir em desenvolvimento

Na **raiz** do repositório (scripts em `package.json`):

```bash
# Base de dados (Postgres só — raiz)
npm run db:up

# Opcional: Postgres + MinIO (Bloco 4 / storage dev)
npm run dev:infra

# Migrações + seed (Prisma vive em apps/web para migrate/seed)
npm run db:migrate
npm run db:seed

# Três processos em terminais separados (ou em background):
npm run dev:api    # :4000
npm run dev:web    # :3000
npm run dev:worker
```

Ordem recomendada: **DB** → **migrate/seed** → **api** → **web** → **worker** (worker depende de jobs na BD).

---

## Next.js como BFF / proxy

- Pedidos do browser a **`/api/...`** no Next são tratados por **`apps/web/app/api/**/route.ts`**.
- A implementação típica chama **`forwardToApi`**, **`forwardBinaryToApi`** ou **`forwardMultipartToApi`** (`apps/web/src/server/forward-to-api.ts`), que fazem `fetch(API_BASE_URL + path)` com o mesmo método e corpo.
- **Contratos públicos** (JSON, status, headers de download) são os da **`apps/api`**, não reimplementados no Next.

---

## Migração e arquitectura (links curtos)

| Documento | Conteúdo |
|-----------|----------|
| [bloco-5.md](migration/bloco-5.md) | Storage, MinIO, `MediaAsset`, evolução de disco vs object storage |
| [bloco-6.md](migration/bloco-6.md) | Worker, transcriptions/jobs, batch, extração do Next |
| [bloco-7.md](migration/bloco-7.md) | Cues / subtitle-files HTTP, PRs 7.1–7.4 |
| [bloco-7-pos-fechamento.md](migration/bloco-7-pos-fechamento.md) | Balanço pós–Bloco 7 |
| [bloco-8.md](migration/bloco-8.md) | Higiene BFF, remoção de órfãos, **este doc (PR 8.3)** |

**Bloco 9** (storage de produção, read path remoto): futuro; ver `bloco-5.md`.

---

## Reorganização principal

Os Blocos **5–8** fecham a linha de **HTTP do editor na API**, **BFF consistente no Next**, **limpeza de legado** e **documentação operacional**. O passo seguinte de produto é **Bloco 9** quando houver prioridade (MinIO/produção), não bloqueante para desenvolvimento local descrito aqui.

---

## Scripts úteis na raiz

| Comando | Descrição |
|---------|-----------|
| `npm run storage:bootstrap` | Buckets/storage (API) |
| `npm run media:reconcile` | Reconciliação `MediaAsset` (API) |
| `npm run db:down` | Parar Postgres (compose raiz) |

---

*Para detalhes de PRs antigos ou decisões históricas, seguir os links na tabela acima.*

---

## Fecho da fase (Blocos 5–8)

### O que foi concluído

- **Arquitectura:** domínio HTTP do editor em **`apps/api`**; **`apps/web`** como UI + BFF/proxy coerente (`forward-to-api`); **`apps/worker`** para trabalho assíncrono; **`packages/shared`** como workspace partilhado.
- **Higiene:** Bloco 8 (forward unificado, remoção de órfãos documentada, sem mudar contratos públicos).
- **Documentação:** este ficheiro + **`README.md`** na raiz; histórico e decisões em **`docs/migration/bloco-5.md` … `bloco-8.md`**.

### Evolução futura (fora do âmbito desta fase)

- **Bloco 9** — storage em **produção** (ex.: MinIO/S3, read path remoto, políticas); ver `bloco-5.md`.
- Runbooks de **deploy** específicos de ambiente (se necessário, além deste doc de dev).

### Checklist final de estado do monorepo

| Item | Estado esperado |
|------|-----------------|
| API de domínio | Rotas principais em **`apps/api`**; Next não é dono da lógica HTTP de negócio. |
| BFF | Proxies em **`apps/web/app/api`** alinhados aos helpers **`forward-to-api`**. |
| Worker | Jobs assíncronos em **`apps/worker`**; BD e filas conforme desenho actual. |
| Documentação operacional | **`docs/monorepo-operacao.md`** + **`README.md`** na raiz actualizados e coerentes com scripts da raiz. |
| Migração histórica | Blocos **5–8** fechados; **Bloco 9** tratado como roadmap, não como dívida bloqueante do dev local. |

**Esta fase está encerrada:** desenvolvimento local e compreensão do monorepo não dependem de concluir o Bloco 9.
