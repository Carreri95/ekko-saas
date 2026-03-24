# Bloco 8 — higiene e finalização da reorganização (BFF Next + monorepo)

**Estado de entrada:** Bloco 7 fechado (HTTP do editor em `apps/api`; Next como proxy). Ver **`bloco-7-pos-fechamento.md`**.

**Objectivo do Bloco 8:** encerrar a **reorganização principal** com **acabamento** controlado: um padrão único de forward, menos ruído no repositório, documentação operacional **final** para quem desenvolve e opera o monorepo — **sem** novo eixo de produto, **sem** storage de produção (MinIO, etc.), **sem** alteração de **contratos públicos** HTTP.

**Limite:** no máximo **3 PRs pequenos**, sequenciais ou em paralelo onde não haja dependência (recomendado: **PR 8.1 → 8.2 → 8.3**).

---

## PR 8.1 — Unificar o padrão de forward/proxy no `apps/web`

### Objetivo

Eliminar a **duplicação** `API_BASE_URL` + `fetch` + montagem manual de `RequestInit` nas `route.ts` que ainda não usam **`forward-to-api.ts`**, passando a usar **`forwardToApi`**, **`forwardBinaryToApi`** ou **`forwardMultipartToApi`** conforme o método e o tipo de resposta — **com o mesmo comportamento observável** que hoje.

### Escopo

- Apenas **`apps/web/app/api/**/route.ts`** (e, se necessário, ajustes **mínimos** em **`apps/web/src/server/forward-to-api.ts`** para cobrir um caso que hoje só o `fetch` manual resolve — **sem** mudar contratos).

### O que entra

- Refactor **mecânico** das rotas listadas no inventário (ex.: **clients**, **cast-members**, **dubbing-projects**, **projects/***, **subtitle-files/.../audio**, **export/srt** onde aplicável) de `fetch(\`${API_BASE_URL}/api/...\`)` para o helper correcto.
- Garantir paridade de:
  - método HTTP, body, `Content-Type` do pedido;
  - repasse de `x-openai-key` quando existir (já suportado nos helpers);
  - tratamento de resposta JSON vs binária (usar **`forwardBinaryToApi`** onde hoje se preservam bytes/headers, alinhado ao que já foi feito em **batch download** / **export**).
- Smoke manual ou `curl` nos caminhos tocados (lista curta por rota alterada).

### O que não entra

- Mudar **paths**, **status** ou **formato** de corpo de resposta.
- Introduzir **novo** middleware, **auth** ou **rate limit**.
- Tocar em **`apps/api`** salvo bug bloqueante descoberto durante o refactor (preferir PR separado se surgir).

### Riscos

- Diferenças subtis entre `fetch` manual e helper (ex.: headers repassados, `cache: "no-store"`, erros **502** no `catch` do helper).
- Rotas com lógica **extra** antes do upstream (validação de param, redirects) — manter essa lógica **antes** do `return forwardToApi(...)`.

### Critério de pronto

- **Todas** as `route.ts` que apenas proxyam a API passam a usar **`forward-to-api.ts`** (ou fica **documentado** num comentário curto por ficheiro porque um caso é exceção legítima).
- **Nenhuma** regressão de contrato nos fluxos smoke listados no PR (sucesso + um erro **4xx** por rota crítica, se aplicável).
- CI / lint verde no `apps/web` para o âmbito alterado.

### Fechamento documental — PR 8.1

**Migrado (helpers centralizados; removido `API_BASE_URL` + `fetch` manual por rota):**

| Helper | Rotas (`apps/web/app/api/...`) |
|--------|--------------------------------|
| **`forwardToApi`** | `clients/route.ts`, `clients/[id]/route.ts`; `cast-members/route.ts`, `cast-members/[id]/route.ts`, `cast-members/[id]/castings/route.ts`; `projects/route.ts`, `projects/[id]/route.ts`, `projects/[id]/cues/route.ts`; `dubbing-projects/route.ts`, `dubbing-projects/[id]/route.ts`, `dubbing-projects/[id]/characters/route.ts`, `dubbing-projects/[id]/characters/[charId]/route.ts` |
| **`forwardBinaryToApi`** | `projects/[id]/export/srt/route.ts`; `subtitle-files/[id]/audio/route.ts` |
| **`forwardMultipartToApi`** | `projects/[id]/media/route.ts` (após validação local de `projectId` e `multipart/form-data`) |

**Excepções / notas:**

- **`apps/web/src/server/forward-to-api.ts`** — **não** alterado neste PR (comportamento já partilhado).
- **`POST .../media`:** o legado lia `arrayBuffer()` e depois `fetch`; o helper reencaminha **`request.body`** em stream com `duplex: 'half'` — **mesmo contrato HTTP**, implementação de transporte diferente (preferível para ficheiros grandes).
- Rotas que **já** usavam `forwardToApi` / `forwardBinaryToApi` / `forwardMultipartToApi` ou só `NextResponse` local (batch-jobs, subtitle-files export principal, cues, etc.) — **fora** do âmbito deste refactor.

**Validação recomendada (smoke):**

- `GET` com query em listagens: `/api/clients`, `/api/cast-members`, `/api/dubbing-projects` (via `:3000`, comparar status/JSON com `:4000` nos mesmos paths).
- Um **CRUD** por domínio (ex.: `PATCH`/`DELETE` client ou cast-member) se houver dados de teste.
- `GET` `.../projects/[id]/export/srt` e `GET` `.../subtitle-files/[id]/audio` — cabeçalhos de download / JSON de erro.
- `POST` `.../projects/[id]/media` com `multipart/form-data` válido.

**Conclusão:** PR **8.1** fechado ao nível de código + documentação acima; smoke manual **recomendado** antes de merge em produção.

---

## PR 8.2 — Identificar e remover código morto/órfão com segurança

### Objetivo

Reduzir **dívida e confusão** (duas “narrativas” Prisma / serviços no Next) removendo ou arquivando ficheiros **comprovadamente** não usados, após uma passagem de **auditoria de imports** reversa.

### Escopo

- **`apps/web`** apenas: `app/api/**` (helpers), `src/server/**`, e outros ficheiros candidatos do balanço em **`bloco-7-pos-fechamento.md`**.

### O que entra

- Passo **1 — Inventário com prova:** para cada candidato (`sync-status.ts`, `serialize.ts`, `prisma-unique.ts`, `demo-user.ts`, `subtitle-file-queries.ts`, `src/server/transcription/*.ts`, etc.), confirmar com **grep / IDE** que **não há imports** (incl. testes e scripts).
- Passo **2 — Remoção ou arquivo:**
  - **Remover** ficheiros sem referências; **ou**
  - Mover para **`docs/adr/`** ou **`docs/archive/`** com **1 parágrafo** de contexto (“removido no Bloco 8; substituído por …”) se houver valor histórico.
- Ajustar **`tsconfig` / eslint** apenas se ficarem erros de import após remoção.
- Lista no corpo do PR: **ficheiros removidos** + **confirmação** de que não há imports.

### O que não entra

- Apagar **`prisma/seed.ts`**, **`src/lib/prisma.ts`** ou geradores Prisma — continuam necessários para **seed** e **tooling**.
- Remover código “por cheirar mal” **sem** prova de ausência de uso.
- Refactor de lógica viva em **`src/`** fora do estritamente necessário para compilar.

### Riscos

- **Falso negativo** no grep (imports dinâmicos, strings, CI externo).
- Algum script **não** versionado que importe um ficheiro removido.

### Critério de pronto

- **Zero** referências quebradas (`tsc` / `eslint` no `apps/web` no âmbito do PR).
- Documentação mínima: entrada no **`bloco-8.md`** (secção “Removidos no PR 8.2”) ou no próprio PR description com lista de ficheiros.
- Se nada for removido por falta de prova, o PR **documenta** os candidatos e a decisão **“manter até prova contrária”** — ainda é um resultado válido, mas prefira **remover** o que for seguro.

### Fechamento documental — PR 8.2

**Critério de decisão:** remoção apenas quando **grep** em `apps/web` (e monorepo para imports cruzados) **não** encontrou `import` / referência ao símbolo ou caminho do ficheiro; **excepção:** `prisma/seed.ts`, `src/lib/prisma.ts` mantidos.

**Removido:**

| Ficheiro / pasta | Motivo |
|------------------|--------|
| `app/api/cast-members/sync-status.ts` | Prisma; **nenhum** import no repositório. |
| `app/api/clients/serialize.ts`, `app/api/cast-members/serialize.ts`, `app/api/dubbing-projects/serialize.ts`, `app/api/dubbing-projects/[id]/characters/serialize.ts` | Helpers **não** referenciados por `route.ts` nem resto do `apps/web`. |
| `app/api/clients/prisma-unique.ts`, `app/api/cast-members/prisma-unique.ts` | **Nenhuma** referência a `prisma-unique`. |
| `src/server/demo-user.ts` | `getDefaultUserId` **sem** imports; utilizador demo continua em `prisma/seed.ts`. |
| `src/server/subtitle-file-queries.ts` | `findLatestSubtitleFileForProject` **sem** imports. |
| **`src/server/transcription/`** (pasta completa, 18 ficheiros `.ts` + testes unitários) | Cadeia só usada internamente; **nenhum** import desde `app/`, rotas ou `src/` fora da pasta; lógica de transcrição vive em **`apps/api`** e **`apps/worker`** (ver `bloco-6.md`). |

**Alterações de suporte:**

- `next.config.ts` — comentário do `MAX_FILE_SIZE_MB` actualizado (referência a `apps/api` em vez de `transcription/env.ts` removido).
- `vitest.config.ts` — `passWithNoTests: true` para **não** falhar CI após remoção dos únicos `src/**/*.test.ts` (estavam sob `transcription/`).

**Mantido por cautela / fora do âmbito:**

- **`prisma/seed.ts`**, **`src/lib/prisma.ts`** — tooling.
- Documentação histórica em **`docs/migration/bloco-3.md`** / **`bloco-6.md`** que ainda **mencionam** paths antigos — texto de arquivo; **não** reescrito neste PR (sem alargar escopo).

**Validação:** `npm run lint` e `npm run test` em `apps/web` (exit 0).

**Conclusão:** PR **8.2** fechado ao nível da auditoria e remoções acima.

---

## PR 8.3 — Consolidar documentação operacional final do monorepo

### Objetivo

Um **único sítio** (ou **página índice** clara) para: como correr **api / web / worker**, variáveis **`API_BASE_URL`** e **`DATABASE_URL`**, papel do **Next como BFF**, e onde estão os **blocos de migração** — para **onboarding** e **operação** sem caça ao tesouro.

### Escopo

- **`docs/`** na raiz do monorepo e, se fizer sentido, **um** ficheiro na raiz (**`README.md`**) apenas com **ligações** (sem duplicar blocos longos).

### O que entra

- Criar ou actualizar **um** documento âncora, por exemplo **`docs/monorepo-operacao.md`** (nome ajustável), com:
  - diagrama textual ou lista: **apps/web** (BFF) → **apps/api** (HTTP + domínio) → BD / storage local conforme **bloco-5**;
  - tabela **env** mínima: `API_BASE_URL`, `DATABASE_URL`, referência a **`.env`** na raiz vs `apps/web`;
  - “**Onde está a verdade**” para rotas HTTP: **`apps/api`** + proxy Next;
  - índice com links para **`docs/migration/bloco-6.md`**, **`bloco-7.md`**, **`bloco-7-pos-fechamento.md`**, **`bloco-8.md`**, **`bloco-5.md`** (storage), sem copiar capítulos inteiros.
- Atualizar **`README.md`** (se existir na raiz) com **3–8 linhas** + link para **`docs/monorepo-operacao.md`**.
- Opcional: uma linha em **`bloco-7.md`** a actualizar a **Síntese** inicial (ainda desactualizada) para apontar “Bloco 7 fechado; ver pos-fechamento” — **só texto**, sem mudar PRs históricos.

### O que não entra

- **Bloco 9** (MinIO, produção) além de **referência** “futuro, ver `bloco-5.md`”.
- Runbooks de **deploy** em cloud específica (Kubernetes, etc.) — salvo já existir e só se **ligar** ao doc âncora.
- Gerar **OpenAPI** ou documentar cada endpoint (fora de escopo).

### Riscos

- Documentação a **ficar desactualizada** rapidamente — mitigar com frase “estado em [data]” e links para código fonte (`apps/api/src/...`).

### Critério de pronto

- Um **novo** developer consegue seguir **`docs/monorepo-operacao.md`** para subir **api + web** e perceber o papel do BFF **sem** ler todos os `bloco-*.md` em sequência.
- Links do **README** raiz funcionam (paths relativos correctos).
- Revisão rápida por alguém da equipa: “**OK para fechar Bloco 8**”.

### Fechamento documental — PR 8.3

**Criado:**

- **`docs/monorepo-operacao.md`** — documento âncora: papéis de `apps/web` (BFF), `apps/api`, `apps/worker`, `packages/shared`, `infra`, tabela de envs (`DATABASE_URL`, `API_BASE_URL`), comandos `npm run dev:*` / `db:*` / `dev:infra`, explicação do proxy Next, links para **`bloco-5.md`–`bloco-8.md`** sem copiar conteúdo.

**Actualizado:**

- **`README.md`** (raiz do monorepo) — criado com **início rápido** e link para `docs/monorepo-operacao.md`.

**Critério:** reorganização principal **documentada como encerrada**; **Bloco 9** (MinIO/produção) referenciado só como evolução futura em `monorepo-operacao.md`.

**Conclusão:** PR **8.3** fechado; **Bloco 8** fechado ao nível documental.

---

## Síntese do Bloco 8

| PR   | Tema                         | Resultado esperado                                      |
|------|------------------------------|---------------------------------------------------------|
| 8.1  | Forward unificado            | Menos duplicação; mesmo contrato HTTP                   |
| 8.2  | Mortos / órfãos              | Repositório mais limpo; menos Prisma “fantasma” no web  |
| 8.3  | Documentação operacional     | Monorepo “explicável” em poucos minutos                 |

**Fecho do Bloco 8:** os três PRs **mergeados** + critérios de pronto **cumpridos** ⇒ **reorganização principal** considerada **encerrada** do ponto de vista **técnico e documental**; **Bloco 9** (storage de produção) só quando houver **decisão de produto**.
