# Operação do monorepo SubtitleBot

**Estado:** documento âncora após reorganização principal (Blocos 5–8). **Última actualização:** 2026-03 (secção Prisma pós-consolidação: operações e cenários).

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
| **`DATABASE_URL`** | Raiz `.env` (e consumo em `apps/api`, `apps/web` Prisma/seed, `apps/worker`) | Ligação PostgreSQL. Ex.: `postgresql://postgres:postgres@localhost:5432/subtitle_studio?schema=public` |
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

# Migrações + seed (Prisma: **schema e migrations canónicos em apps/api**; `apps/web/prisma.config.ts` aponta para o mesmo schema; seed continua em apps/web)
npm run db:migrate
npm run db:generate
npm run db:seed

# Três processos em terminais separados (ou em background):
npm run dev:api    # :4000
npm run dev:web    # :3000
npm run dev:worker
```

Ordem recomendada: **DB** → **migrate/seed** → **api** → **web** → **worker** (worker depende de jobs na BD).

---

## Prisma (pós-consolidação): operação segura

**Fonte única:** schema e migrations em **`apps/api`**; comandos na **raiz** delegam para `apps/api`. Ver também `ENGINEERING-RULES.md` §18.2.

### Quando usar cada comando (`npm run` na raiz)

| Comando | Função | Quando usar |
|---------|--------|-------------|
| **`db:migrate`** | `prisma migrate dev` em `apps/api` | **Desenvolvimento local** quando alteras `apps/api/prisma/schema.prisma` e queres criar uma **nova** migração e aplicá-la. **Não** é o fluxo típico de CI que só aplica ficheiros já commitados. |
| **`db:deploy`** | `prisma migrate deploy` em `apps/api` | **CI, staging, produção** (e qualquer ambiente que só deve **aplicar** migrações já versionadas, sem prompts). Falha se o histórico em `_prisma_migrations` não for compatível com as pastas no repo. |
| **`db:generate`** | `prisma generate` em `apps/api` | Depois de **pull** com mudanças em schema/migrations, ou quando o client Prisma (API **e** web via generator `client_web`) estiver desactualizado. Obrigatório antes de `build` se o schema mudou. |
| **`db:seed`** | `prisma db seed` via `apps/web` | Quando precisas dos dados do `seed.ts` (ex.: utilizador demo). **Só** faz sentido com uma BD já migrada e normalmente **vazia** de dados de negócio que o seed duplica. |

**Riscos a não esconder:** `db:deploy` numa BD com histórico **mentiroso** (ficheiros em falta, nomes antigos) pode falhar ou aplicar migrações em ordem inesperada. Em dúvida sobre o estado da BD, **inspeccionar `_prisma_migrations`** antes (ver cenário 3).

---

### Cenário 1 — Ambiente novo / base de dados nova

**Objectivo:** subir Postgres vazio e ficar alinhado com o repo actual.

1. `npm run db:up` (ou Compose equivalente) com `DATABASE_URL` correcto no `.env`.
2. `npm run db:deploy` — aplica toda a cadeia em `apps/api/prisma/migrations` (sem prompts).
3. `npm run db:generate` — gera clients.
4. `npm run db:seed` — opcional, para utilizador demo e dados de seed.

**Não** é necessário `migrate resolve` nem reset de volume. **Não** usar `db:migrate` em CI para “só aplicar” — usar **`db:deploy`**.

---

### Cenário 2 — Desenvolvimento local já migrado (histórico antigo pré-consolidação)

**Sintomas possíveis:** erros Prisma (`P3009`, `P3018`, coluna inexistente), ou migrações antigas aplicadas só a partir de `apps/web` / só de `apps/api`.

**Caminho mais seguro para dev (aceita perder dados locais):**

1. Parar containers: `npm run db:down`.
2. **Resetar volume** do Postgres: `docker compose down -v` na raiz (apaga dados do volume nomeado; **destructivo**).
3. `npm run db:up` → `npm run db:deploy` → `npm run db:generate` → `npm run db:seed`.

**Se não podes apagar dados locais:** alguém da equipa deve comparar o conteúdo de `_prisma_migrations` com as pastas actuais em `apps/api/prisma/migrations` e decidir `prisma migrate resolve` (marcar como aplicada / rolled back) **caso a caso** — não há receita única sem inspecção. Os pontos sensíveis da consolidação estão descritos em baixo (nomes de migrações de convite e `episode_edited_at`).

---

### Cenário 3 — Staging / partilhado / histórico misto em `_prisma_migrations`

**Risco:** a mesma BD pode ter sido migrada em momentos diferentes (só web, só api, ordem antiga). O Prisma compara **ficheiros no disco** com **linhas em `_prisma_migrations`**.

**Antes de correr qualquer coisa em produção/staging:**

1. **Backup** da BD.
2. **Inspeccionar** `SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations ORDER BY started_at;` (ou ferramenta equivalente).
3. Comparar com a lista de pastas em **`apps/api/prisma/migrations`** no commit que vais deployar.

**Quando usar `prisma migrate resolve`:** quando o Prisma reporta migração “falhada” ou “já aplicada manualmente” e a equipa confirma o estado real da BD — **nunca** como atalho sem entender o estado. Documentação oficial: [Prisma migrate resolve](https://www.prisma.io/docs/orm/reference/prisma-cli-reference#migrate-resolve).

**Consolidação concreta (referência para suporte):**

- Se existir **`20260324210000_invite_email_dispatch`** aplicado e a tabela `InviteEmailDispatch` já criada, **não** reaplicar o SQL da migração renomeada **`20260325131000_invite_email_dispatch`** sem análise — pode exigir `resolve` ou baseline.
- Duplicidade **`20260324183000_episode_edited_at`** vs **`20260324150000_episode_edited_at`**: se ambas constarem ou houver `editedAt` duplicado na BD, **correcção manual** / DBA — fora do âmbito de um script cego.

---

### Checklist rápido — developer (local)

- [ ] `.env` com `DATABASE_URL` apontando ao Postgres local.
- [ ] BD nova ou `db:deploy` sem erros após pull.
- [ ] `npm run db:generate` após mudanças de schema/migrations.
- [ ] `npm run db:seed` quando precisares do utilizador demo.
- [ ] Em erro estranho de migração: considerar `docker compose down -v` + `db:up` + `db:deploy` **só** se puderes apagar dados locais.

---

### Checklist rápido — ambiente já migrado (não destrutivo)

- [ ] Backup antes de qualquer `db:deploy` em dados não descartáveis.
- [ ] Inspeccionar `_prisma_migrations` vs pastas do repo no mesmo commit.
- [ ] Usar **`db:deploy`** (não `db:migrate`) em CI/staging/prod para aplicar migrações versionadas.
- [ ] Se falhar: ler mensagem Prisma; avaliar `migrate resolve` com contexto da BD, não “à cegas”.
- [ ] Documentar qualquer intervenção manual na BD para a equipa.

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
| [bloco-auth-1.md](migration/bloco-auth-1.md) | Fundação auth: enum `Role`, `User`/`Session`, seed admin, `packages/shared` (`Role`) |
| [bloco-invite-1.md](migration/bloco-invite-1.md) | Modelo `Invite` (hash, expiração, FK `User`); sem email/UI/aceite |

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
| `npm run db:studio` | Prisma Studio — schema canónico **`apps/api`** → **http://localhost:5556** |
| `npm run db:studio:web` | Prisma Studio via `apps/web` (mesmo schema apontado para a API) → **http://localhost:5555** |

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
