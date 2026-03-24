# Bloco 7 — plano pós-Bloco 6 (inventário e roadmap)

**Nota:** texto **histórico** de plano e PRs; migrações descritas estão **fechadas**. Para operação actual do monorepo, ver **`docs/monorepo-operacao.md`**.

**Estado de entrada:** Bloco 6 fechado (worker, transcriptions/jobs em `apps/api`, `batch-jobs` completo até `GET .../download`, forward no Next onde aplicável).

Este documento regista o **balanço operacional** do que ainda existe em `apps/web/app/api` e propõe o **Bloco 7** e blocos seguintes, **sem** alargar escopo técnico além do descrito.

---

## 1. Rotas / domínios que ainda existem em `apps/web/app/api/*`

| Área | Caminhos (ficheiros `route.ts`) |
|------|----------------------------------|
| **Projetos** | `projects/route.ts`, `projects/[id]/route.ts`, `projects/[id]/media`, `projects/[id]/cues`, `projects/[id]/transcriptions`, `projects/[id]/export/srt` |
| **Jobs / transcrição** | `jobs/[jobId]/status`, `retry`, `reprocess-normalization` |
| **Batch** | `batch-jobs` (raiz), `[batchId]`, `[batchId]/files`, `start`, `download`, `jobs`, `jobs/[jobId]/retry` |
| **Subtitle / cues** | `subtitle-files/[id]`, `subtitle-files/[id]/audio`, `subtitle-files/[id]/export`, `subtitle-cues/bulk-update`, `cues/batch` (reexport), `cues/[cueId]` |
| **Clientes / casting / dobragem** | `clients`, `clients/[id]`, `cast-members`, `cast-members/[id]`, `cast-members/[id]/castings`, `dubbing-projects`, `dubbing-projects/[id]`, `dubbing-projects/[id]/characters`, `dubbing-projects/[id]/characters/[charId]` |

~~Há também **helpers** ao lado das rotas (`serialize.ts`, `prisma-unique.ts`, etc.)~~ — **removidos no PR 8.2** (`bloco-8.md`) por estarem órfãos.

---

## 2. Legado relevante (Bloco 7 — estado actual)

| Rota | Papel |
|------|--------|
| **`GET` `.../subtitle-files/[id]`** | **PR 7.1:** `apps/api` + **forward** no Next. |
| **`PATCH` `.../cues/[cueId]`** | **PR 7.2:** `apps/api` + **forward** no Next. |
| **`GET` `.../subtitle-files/[id]/export`** | **PR 7.3:** `apps/api` + **forward** no Next (`forwardBinaryToApi`). |
| **`POST` `.../subtitle-cues/bulk-update`** (e **`POST` `.../cues/batch`**) | **PR 7.4:** `apps/api` + **forward** no Next (`forwardToApi`); **`/cues/batch`** encaminha para a **mesma** rota na API. |

O saldo de migração **funcional** do Bloco 7 para **subtitle-files / cues HTTP** está **fechado** no **PR 7.4** (escrita em massa); **`GET .../export`** tinha sido migrado no **PR 7.3**.

O resto das rotas listadas em (1) está, na prática, em modo **proxy/forward** para `apps/api` (`forwardToApi`, `forwardMultipartToApi`, `forwardBinaryToApi` ou `fetch` local equivalente).

---

## 3. Resíduos menores (dívida técnica, não buraco de produto)

- **Vários `forward` duplicados** (`API_BASE_URL` + `fetch` + `text()`) em `clients`, `cast-members`, `dubbing-projects`, `projects/*` — mesmo padrão que `forward-to-api.ts`; consolidação cosmética, não migração de domínio.
- ~~**Ficheiros `serialize.ts` / `prisma-unique.ts`** sob `app/api/...`~~ — **removidos no PR 8.2** (órfãos).
- ~~**`cast-members/sync-status.ts`**~~ — **removido no PR 8.2** (código morto confirmado).

---

## 4. Próximo bloco maior sugerido

**Bloco 7 — domínio subtitle / cues na API HTTP**

**Bloco 7 (HTTP subtitle / cues):** **`POST .../subtitle-cues/bulk-update`** migrado no **PR 7.4** (com paridade **`POST .../cues/batch`**). **`GET .../export`** foi migrado no **PR 7.3** (`forwardBinaryToApi`).

---

## 5. Porque o Bloco 7 deve vir antes dos outros

- **Escrita HTTP de cues** em massa passou a ter **dono único** na API após o **PR 7.4**; o risco de regras duplicadas nesse fluxo reduz-se ao legado já removido do Next.
- **Dependências naturais:** `projects`, `jobs`, `batch-jobs` e export SRT parcial já na API; fechar **cues + subtitle-file read/write HTTP** completa o plano de dados do editor em `apps/api`.
- **MinIO**, multi-tenant, observabilidade ganham pouco enquanto o caminho feliz de edição de legendas está bifurcado.

---

## 6. O que não vale a pena mexer agora (sem necessidade de negócio)

- Refactor **só** para unificar helpers de forward no Next.
- **MinIO / storage remoto** como “big bang” antes de o HTTP de cues estar estável na API.
- **Auth avançada / RBAC** em todo o monorepo, se o objectivo imediato é paridade de API.
- Apagar `serialize` / `sync` **sem** trilho de testes e PR dedicado.

---

## 7. Roadmap curto (2–3 blocos)

| Ordem | Bloco | Foco |
|-------|--------|------|
| **1** | **Bloco 7** — Cues & `subtitle-files` (HTTP) | Migração das rotas em (2); Next só forward; critério: mesmo contrato, smoke editor + bulk + export. |
| **2** | **Bloco 8** — Higiene do Next como BFF | Consolidar `forward-to-api`, documentar `API_BASE_URL`; opcional: morte segura de código órfão. |
| **3** | **Bloco 9** — Storage de produção (se prioridade) | MinIO / read path / `MediaAsset` alinhado a `bloco-5.md`, **depois** do plano de dados HTTP fechado. |

---

## Síntese

**Actualização:** o domínio **cues / subtitle-files** foi migrado para `apps/api` (PRs 7.1–7.4); o **Bloco 8** fechou higiene BFF e documentação (**`docs/monorepo-operacao.md`**). O parágrafo abaixo reflecte o estado **à data do início** do Bloco 7.

Depois do fecho do Bloco 6, o saldo **substancial** em `apps/web/app/api` era o **domínio de cues / subtitle-files** ainda servido pelo Next. O resto era sobretudo **proxy** ou **resíduo de organização de código**.

---

## PR 7.1 — `GET /api/subtitle-files/:id`

### Objectivo

- Migrar **`GET /api/subtitle-files/:id`** para **`apps/api`** (dono oficial), com **`apps/web`** apenas **`forwardToApi`**.
- **Fora deste PR (à data do 7.1):** `POST /api/subtitle-cues/bulk-update`, `PATCH /api/cues/:cueId`, `GET /api/subtitle-files/:id/export`; **`GET .../audio`** não foi alterado (já na API).

### Rota migrada

| Método | Caminho | Dono |
|--------|---------|------|
| `GET` | `/api/subtitle-files/:id` | `apps/api` |

Implementação: `subtitle-file-detail.service.ts` + registo em `apps/api/src/modules/subtitle-files/routes.ts` (rota **`/audio`** mantida **antes** de **`/:id`** no registo).

### Critério de pronto (7.1)

- Resposta JSON com `subtitleFileId`, `filename`, `wavFilename`, `wavPath`, `projectId`, `cues[]` (ordenados por `cueIndex` asc); erros **400** / **404** com as mesmas mensagens que o legado.

### Fechamento documental — validação operacional PR 7.1

**Validado:**

| Item | Resultado |
|------|-----------|
| **`GET .../subtitle-files/:id` em `apps/api`** (`:4000`) | **200** com `subtitleFileId`, metadados e `cues[]`; **404** `SubtitleFile nao encontrado` para id inexistente. |
| **`GET .../subtitle-files/:id` via `apps/web`** (`forwardToApi`, `:3000`) | Mesmos **status** e **JSON** que a API nos cenários testados (sucesso e 404). |
| **SubtitleFile existente** | **200**; `wavFilename`, `wavPath` e `projectId` presentes no payload. |
| **SubtitleFile inexistente** | **404** com mensagem alinhada à API. |
| **Cues** | Ordem **`cueIndex` asc** confirmada (ex.: ficheiro com múltiplos cues). |
| **`GET .../subtitle-files/:id/audio`** | **200** na API e no web; **não** regrediu com este PR (rota `/audio` não foi alterada). |

**Fora do PR 7.1 (confirmado):** `POST /api/subtitle-cues/bulk-update`, `PATCH /api/cues/:cueId`, `GET /api/subtitle-files/:id/export` — **não** migrados *(nota: `PATCH /api/cues/:cueId` foi migrado no **PR 7.2**; `GET .../export` no **PR 7.3**)*.

**Ressalvas:**

- **Path malformado / trailing slash** (`/api/subtitle-files/` sem id): pode **divergir** entre **Fastify** (ex.: **400** `subtitleFileId obrigatorio`) e **Next** (ex.: **308** redirect) — canto de routing, não do contrato do `GET` com `id` válido no segmento.
- **Smoke manual** no editor / browser (`/subtitle-file-edit?subtitleFileId=...`) continua **recomendado**, **não bloqueante** para fecho documental deste PR.

**Conclusão:** **PR 7.1 fechado** ao nível da validação operacional descrita.

---

## PR 7.2 — `PATCH /api/cues/:cueId`

### Objectivo

- Migrar **`PATCH /api/cues/:cueId`** para **`apps/api`** (dono oficial), com **`apps/web`** apenas **`forwardToApi`**.
- **Fora deste PR (à data do 7.2):** `GET /api/subtitle-files/:id/export`, `POST /api/subtitle-cues/bulk-update`; **`subtitleVersion`**, **`GET .../audio`**, e outras rotas do Bloco 7 **não** entram. *(O **export** foi migrado depois no **PR 7.3**.)*

### Rota migrada

| Método | Caminho | Dono |
|--------|---------|------|
| `PATCH` | `/api/cues/:cueId` | `apps/api` |

Implementação: `cue-patch.service.ts` + `apps/api/src/modules/cues/routes.ts` (plugin encapsulado com `setErrorHandler` para `Body JSON invalido` alinhado ao legado).

### Critério de pronto (7.2)

- Actualização de `text`, `startMs`, `endMs`; validação `startMs < endMs`; resposta JSON com `id`, `cueIndex`, `startMs`, `endMs`, `text`, `subtitleFileId`; erros **400** / **404** com mensagens do legado.

### Fechamento documental — validação operacional PR 7.2

**Validado:**

| Item | Resultado |
|------|-----------|
| **`PATCH .../cues/:cueId` em `apps/api`** (`:4000`) | **200** com shape esperado; **400** / **404** com mensagens alinhadas ao legado. |
| **`PATCH .../cues/:cueId` via `apps/web`** (`forwardToApi`, `:3000`) | Mesmos **status** e **JSON** que a API nos cenários testados. |
| **Cue existente** | **200**; actualização de `text` e/ou tempos. |
| **Cue inexistente** | **404** `Cue nao encontrada`. |
| **`startMs >= endMs`** | **400** `startMs deve ser menor que endMs`. |
| **JSON inválido** | **400** `Body JSON invalido`. |
| **Body não-objecto** (ex.: array JSON) | **400** `Body JSON invalido`. |
| **Alteração só de `text`** | **200**; tempos mantidos quando não enviados. |
| **Alteração só de tempos** | **200**; `text` mantido quando não enviado. |
| **Persistência na BD** | Valores do cue confirmados via Prisma após PATCH bem-sucedido. |
| **`GET /api/subtitle-files/:id`** | Resposta a reflectir o cue actualizado; paridade API / web verificada. |

**Fora do PR 7.2 (confirmado):** `POST /api/subtitle-cues/bulk-update` — **não** migrado; handlers no Next **ainda** com Prisma onde aplicável. **`GET /api/subtitle-files/:id/export`** estava **fora** do âmbito do 7.2 e foi migrado no **PR 7.3**.

**Ressalva:** smoke **visual** no editor / browser continua **opcional**, **não bloqueante** para fecho documental deste PR.

**Conclusão:** **PR 7.2 fechado** ao nível da validação operacional descrita.

---

## PR 7.3 — `GET /api/subtitle-files/:id/export`

### Objectivo

- Migrar **`GET /api/subtitle-files/:id/export`** para **`apps/api`** (dono oficial), com **`apps/web`** apenas **`forwardBinaryToApi`** (corpo SRT + headers `Content-Type`, `Content-Disposition`, `Cache-Control`, `Content-Length` quando presente).
- **Fora deste PR:** **`POST /api/subtitle-cues/bulk-update`** continua **fora** (não migrado); **`GET /api/subtitle-files/:id`**, **`GET /api/subtitle-files/:id/audio`** **não** foram alterados.

### Rota migrada

| Método | Caminho | Dono |
|--------|---------|------|
| `GET` | `/api/subtitle-files/:id/export` | `apps/api` |

Implementação: `subtitle-file-export.service.ts` + registo em `apps/api/src/modules/subtitle-files/routes.ts` (rota **`/export`** entre **`/audio`** e **`/:id`**).

### Critério de pronto (7.3)

- **200:** corpo `.srt` (`formatSrt`, cues por `cueIndex` asc); nome de ficheiro com a mesma regra que o legado (`toDownloadFilename`); headers de download alinhados ao legado.
- **400** / **404:** texto plano `subtitleFileId obrigatorio` / `SubtitleFile nao encontrado`.

### Fechamento documental — validação operacional PR 7.3

**Validado (smoke `curl`, 2026-03-24, BD local com `SubtitleFile` de teste):**

| Item | Resultado |
|------|-----------|
| **`GET .../export` em `apps/api`** (`:4000`) | **200**; `Content-Type` `application/x-subrip; charset=utf-8`; `Content-Disposition` `attachment; filename="..."`; `Cache-Control` `no-store`; `Content-Length` presente; corpo SRT alinhado aos cues na BD (`cueIndex`, tempos, texto). |
| **`GET .../export` via `apps/web`** (`forwardBinaryToApi`, `:3000`) | **200**; mesmos **status**, **corpo** (bytes idênticos, `fc /b`) e **headers** relevantes (`Content-Type`, `Content-Disposition`, `Cache-Control`, `Content-Length`). Next acrescenta `Vary` (esperado). |
| **SubtitleFile sem cues** | **200**; `Content-Length: 0`; nome de ficheiro com regra `toDownloadFilename`; paridade API / web. |
| **id inexistente** | **404** `text/plain`; corpo `SubtitleFile nao encontrado` (API e web). |
| **Path malformado** | **API** `GET .../subtitle-files//export` → **400** texto `subtitleFileId obrigatorio`. **Next** `...//export` → **308** para `/api/subtitle-files/export` (comportamento de routing; canto já notado no PR 7.1). |
| **Coerência SRT ↔ BD** | Texto e janelas temporais do `.srt` coincidem com `GET /api/subtitle-files/:id` para o mesmo id. |
| **`GET /api/subtitle-files/:id`** | **200** API e web; JSON idêntico (sem regressão). |
| **`GET /api/subtitle-files/:id/audio`** | **404** API e web quando não há WAV (paridade; sem regressão atribuível ao 7.3). |
| **`POST /api/subtitle-cues/bulk-update`** | **Fora** deste PR (à data do 7.3) — migrado depois no **PR 7.4**. |

**Ressalva:** cantos de routing **Next** vs **Fastify** em paths inválidos permanecem possivelmente divergentes; não afectam o contrato com **id** válido no segmento.

**Conclusão:** **PR 7.3 fechado** ao nível da validação operacional descrita.

---

## PR 7.4 — `POST /api/subtitle-cues/bulk-update` (PR pesado / fecho de escrita HTTP de cues no Bloco 7)

### Objectivo

- Migrar **`POST /api/subtitle-cues/bulk-update`** para **`apps/api`** (dono oficial da persistência em massa: delete + create/update, reindexação `cueIndex`, snapshot **`formatSrt`**, nova **`SubtitleVersion`**), com **`apps/web`** apenas **`forwardToApi`**.
- Manter **`POST /api/cues/batch`** **equivalente** ao legado: forward para a **mesma** URL canónica na API (`/api/subtitle-cues/bulk-update`), **sem** mudança de contrato.

### Rotas migradas

| Método | Caminho | Dono |
|--------|---------|------|
| `POST` | `/api/subtitle-cues/bulk-update` | `apps/api` |
| `POST` | `/api/cues/batch` | `apps/api` (mesmo handler que bulk-update) |

Implementação: `cue-bulk-update.service.ts` + registo em `apps/api/src/modules/cues/routes.ts` (plugin com `setErrorHandler` para `Body JSON invalido`).

### Critério de pronto (7.4)

- Paridade com o legado: validações, mensagens de erro, **200** com `subtitleFileId`, `updatedCount` (= `cues.length` enviado), `versionId`, `versionNumber`, `versionCreatedAt`, `cues`.
- **`SubtitleVersion`** e **`srtContent`** coerentes com o estado final dos cues após a transação.

### Fechamento documental — validação operacional PR 7.4

**Contexto:** **Este PR** é o **último PR pesado** do Bloco 7 no eixo de **escrita HTTP de cues** (bulk + versões); o inventário de rotas em (1) para cues/subtitle-files passa a estar em modo **API + forward** onde aplicável.

**Validado (smoke `curl`, BD local):**

| Âmbito | Resultado |
|--------|-----------|
| **`POST .../subtitle-cues/bulk-update` em `apps/api`** (`:4000`) | Contrato alinhado ao legado nos cenários exercitados (erros **400** / **404**, **200** com shape esperado). |
| **Mesmo pedido via `apps/web`** (`forwardToApi`, `:3000`) | Paridade de **status** e **JSON** com a API nos mesmos cenários (payloads com JSON válido). |
| **`POST .../cues/batch`** | Paridade com **`.../bulk-update`** na API (mesmo handler) e no web (forward para a mesma rota canónica); validado com o mesmo body (ex.: lista vazia). |
| **Cenários de erro / validação** | `subtitleFileId` ausente; `cues` ausente; cue inválido (índice N); `startMs >= endMs`; `SubtitleFile` inexistente; IDs duplicados; ID de cue que não pertence ao ficheiro. |
| **Cenários de sucesso** | Lista vazia (`cues: []`); apenas creates; **update + create + delete** no mesmo submit. |
| **`updatedCount`** | Confirmado **`updatedCount === cues.length`** enviado. |
| **Reindexação `cueIndex`** | Ordem final **1..N** conforme o array do payload. |
| **`SubtitleVersion`** | Nova versão em sucesso; **`srtContent`** coerente com **`formatSrt`** dos cues finais na BD. |
| **`GET /api/subtitle-files/:id`** e **`GET .../export`** | Respostas **API** e **web** idênticas entre si e **refletindo** o estado final dos cues após o bulk. |

**Ressalvas:**

- **Body vazio** com **`Content-Type: application/json`** ainda **pode divergir** entre **API directa** (erro do Fastify `FST_ERR_CTP_EMPTY_JSON_BODY`), **web forward** (corpo omitido → validação de campos) e **legado** (`request.json()` → **`Body JSON invalido`**). Não afecta o fluxo normal com JSON válido.
- Smoke **manual** no **editor / browser** continua **recomendado** (não bloqueante para este fecho documental).

**Conclusão:** **PR 7.4 fechado** ao nível da validação operacional descrita.

---

## Ver também

- **`bloco-7-pos-fechamento.md`** — balanço pós-Bloco 7 (rotas só-forward, Prisma residual no Next, Bloco 8 vs 9, estimativa de PRs).
