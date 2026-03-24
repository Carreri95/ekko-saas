# Bloco 6 — worker + transcriptions (extração)

## Estado de entrada

- Blocos 2–4 fechados.
- Bloco 5 fechado até **PR 5.5** (read path de áudio em `apps/api` + forward no Next; bytes ainda no disco local).

---

## PR 6.1 — worker MVP (definição operacional)

### 1. Objetivo exacto

- Introduzir um processo **`apps/worker` (MVP)** que seja a **única** componente a executar o pipeline hoje encapsulado em `runInBackground` (Whisper/Mock → normalização → cues → `DONE`/`FAILED`).
- **Eliminar** em **`apps/web`** qualquer chamada a `runInBackground` / `runJobToCompletion` que execute trabalho in-process (incluindo `POST .../transcriptions`, `retry` e fluxo de **batch** que hoje corre jobs no Node do Next).
- Manter **inalterado o contrato público** das rotas (mesmos URLs e payloads onde já existem); só muda **onde** o trabalho corre.

### 2. Arquitectura mínima do `apps/worker`

| Peça | Função |
|------|--------|
| Processo Node de longa duração | `node` / `tsx` com loop controlado. |
| Cliente Prisma | Mesmo `DATABASE_URL` e schema que web/API. |
| Loop principal | Intervalo configurável (`WORKER_POLL_MS`): sem job → dorme; com job → processa **um** de cada vez (MVP). |
| Shutdown | SIGTERM/SIGINT para sair sem corromper estado (recomendado). |

**Sem** fila externa; **sem** novo serviço além deste processo.

### 3. Ficheiros / módulos a mover ou reutilizar

**Extrair** de `apps/web/src/server/transcription/` o núcleo de `runInBackground` e dependências directas (adapters, `normalizeTranscript`, `CueRepository`, `MediaStorageService` para path do áudio, `getMaxTranscriptionAttempts`, etc.) para **`apps/worker`** ou **`packages/*`** partilhado — **não** importar `apps/web` a partir do worker.

**`TranscriptionJobService` no web** fica **fino**: `createAndEnqueue` só cria `PENDING` **sem** disparar execução; `retry` só actualiza BD **sem** `void runInBackground`.

**Rotas HTTP** permanecem no **Next** neste PR (**não** migrar para `apps/api`).

### 4. Evitar dupla execução (Next vs worker)

- **Web:** proibido `void runInBackground` e proibido `runJobToCompletion` no processo Next após o merge.
- **Worker:** único sítio que executa o runner após **claim**.
- **Retry:** só repõe `FAILED` → `PENDING` na BD; o worker volta a apanhar no poll.
- **Deploy:** evitar versão antiga do web que ainda dispare runner; preferir deploy coordenado web + worker.

### 5. Estratégia mínima (polling, claim, estado, retry/backoff)

- **Polling:** `PENDING`, ordenação `createdAt` asc (FIFO global no MVP).
- **Claim:** `UPDATE` condicional `PENDING` → `RUNNING` (ex.: `updateMany` com `count === 1` ou equivalente).
- **Estados:** igual ao actual: `PENDING` → `RUNNING` → `DONE`/`FAILED` com os mesmos campos (`startedAt`, `completedAt`, `attemptCount`, `errorMessage`).
- **Retry/backoff:** manter o **loop interno** actual (máx. tentativas, `sleep` exponencial, erros não retryable) **dentro do worker** após o claim.
- **Batch:** onde existia `runJobToCompletion` no Next, deixar de executar in-process; jobs ficam `PENDING` e o **mesmo** worker consome (ordem global pode misturar com jobs single-project — aceitável no MVP).

### 6. O que fica temporariamente em `apps/web`

- Todas as rotas HTTP actuais (transcriptions, jobs, reprocess, batch-jobs, etc.).
- Serviço fino: criar job, ler estado, retry só BD, batch só criar/marcar jobs sem pipeline no processo Next.
- Prisma do web.

### 7. O que ainda NÃO entra

- Migração de rotas para `apps/api`.
- Fila externa (Redis, SQS, …).
- Alteração de contrato JSON sem necessidade e documentação.
- Multi-worker horizontal sem claim forte (MVP = 1 instância).
- Read path MinIO para áudio na transcrição (mantém disco / `resolveAbsolutePath` como hoje).

### 8. Variáveis de ambiente do worker

| Variável | Uso |
|----------|-----|
| `DATABASE_URL` | Postgres (igual web/API). |
| `OPENAI_API_KEY` | Whisper (mesma convenção que o web). |
| `MEDIA_STORAGE_DIR` | Se aplicável, alinhar ao upload. |
| `WORKER_POLL_MS` | Intervalo entre ciclos quando não há jobs. |

Ver `apps/worker/.env.example` (a criar na implementação).

### 9. Scripts / comandos de dev

- `apps/worker`: `"dev": "tsx watch src/main.ts"` (ou equivalente), `"start"` pós-build.
- Raiz (opcional): `"dev:worker": "npm run dev --prefix apps/worker"`.
- Documentar: transcrições requerem **web + worker + Postgres + mídia no disco**.

### 10. Riscos principais

- Regressão de **batch** se a ordem/sequência depender do antigo `runJobToCompletion` síncrono no Next.
- Credenciais e paths alinhados ao ambiente de desenvolvimento.
- Duas instâncias de worker sem claim forte → duplicação de trabalho (MVP: uma instância).
- Esquecer o worker no deploy → jobs eternamente `PENDING`.

### 11. Critério de pronto (PR 6.1)

- `apps/worker` processa `TranscriptionJob` `PENDING` → `DONE`/`FAILED` com resultado observável equivalente (cues, estados).
- `apps/web` **não** invoca `runInBackground` nem `runJobToCompletion` para transcrição.
- `POST /api/projects/:id/transcriptions` mantém resposta actual; worker conclui o job **sem** Next.
- Documentação actualizada (este ficheiro + ajustes pontuais se necessário).

### 12. Evidências de validação (pós-implementação)

- Worker **parado:** novo `POST .../transcriptions` → job permanece `PENDING`.
- Worker **a correr:** `RUNNING` → `DONE` (ou `FAILED` esperado).
- `GET .../jobs/.../status` reflecte transições.
- `retry` em `FAILED` → `PENDING` e worker reprocessa.
- Batch (se no escopo do PR): não bloqueia o Next com trabalho longo.
- Smoke no editor: transcrição + cues comparável ao antes.

---

**Resumo:** PR 6.1 = **worker único + BD + mesmo pipeline de execução**, **zero** runner no Next, **sem** novas rotas em `apps/api` e **sem** fila externa, preservando URLs e payloads.

---

## Implementado (PR 6.1) — estado real

### `apps/worker`

- **Entrada:** `src/main.ts` — carrega `apps/worker/.env` via `src/load-env.ts`, instancia `MediaStorageService`, loop com `WORKER_POLL_MS` (predefinição 2000 ms; valores inválidos ou &lt; 200 ms caem para 2000 ms).
- **Polling:** `findFirst` em `TranscriptionJob` com `status = PENDING`, `orderBy.createdAt asc` (FIFO global).
- **Claim:** em `src/transcription/transcription-job-runner.ts`, `updateMany` condicional `PENDING` → `RUNNING` com `startedAt` / `attemptCount` / `errorMessage` limpo; se `count !== 1`, o worker abandona o job (outro processo reclamou ou estado inesperado).
- **Retries internos:** iguais ao comportamento anterior — backoff exponencial (até 8 s), `MAX_TRANSCRIPTION_ATTEMPTS`, detecção de erros não retryable; tentativas subsequentes exigem `RUNNING` e `updateMany` para refrescar `attemptCount`.
- **Pipeline:** lógica equivalente ao antigo `runInBackground` do Next, em `src/transcription/*` (adapters Whisper/Mock, `normalizeTranscript`, `CueRepository`, `MediaStorageService`, `maybeFinalizeBatch` para `BatchJob` quando todos os jobs do lote estão `DONE`/`FAILED`). **Não** há imports de `apps/web`.
- **Prisma:** `PrismaClient` + `PrismaPg` em `src/prisma-client.ts`, import do cliente gerado em **`apps/api/src/generated/prisma`** (mesmo `DATABASE_URL` que web/API). Antes de correr o worker: `npm run db:generate --prefix apps/api`.
- **Mídia:** `MEDIA_STORAGE_DIR` opcional; por defeito `../web/public/uploads/media` relativamente ao `cwd` (típico `apps/worker`).
- **FFmpeg:** dependência `ffmpeg-static` no worker; `FFMPEG_BIN` opcional (igual ao web).
- **Build / start:** `npm run build` executa `tsc --noEmit` (typecheck). **Produção / dev estável:** `npm start` → `tsx src/main.ts` (resolve o cliente Prisma em `.ts` gerado sem empacotar `dist`).

### `apps/web`

- **`TranscriptionJobService`:** `createAndEnqueue` só cria `PENDING`; `retry` repõe `FAILED` → `PENDING` na BD; **sem** `runInBackground` nem `runJobToCompletion`.
- **`BatchJobService.processBatchSequential`:** deixa de executar o pipeline no Next; só marca `RUNNING` no batch quando há jobs `PENDING` ou `DONE` imediato se não houver trabalhos; conclusão do batch no worker (`maybeFinalizeBatch`).
- **Rotas HTTP:** inalteradas neste PR (contrato público preservado).

### Monorepo

- **Raiz:** `dev:worker` → `npm run dev --prefix apps/worker`.
- **Documentação local:** `apps/worker/README.md`, `apps/worker/.env.example`.

---

### Fechamento documental — validação PR 6.1

**O que foi validado (evidência operacional + revisão de código):**

| Item | Resultado |
|------|-----------|
| **Worker parado** | Job criado com estado `PENDING` (equivalente a `createAndEnqueue` / `POST`); sem worker não há progressão automática; código sem `runInBackground` / `runJobToCompletion` no Next para transcrição. |
| **Worker a correr** | Transições `PENDING` → `RUNNING` (claim) → `DONE` (motor **MOCK** no smoke); cues persistidas na BD. |
| **Retry** | Reposição para `PENDING` e reprocessamento pelo worker (validação alinhada à lógica de `retry` na BD; não obrigatório HTTP no smoke). |
| **Batch** | Batch `RUNNING` com job `PENDING` e fecho `DONE` quando o único job termina (`maybeFinalizeBatch`); validação via BD + runner, não pelo fluxo HTTP completo. |
| **Contratos públicos** | Preservados: `POST .../transcriptions` continua `{ jobId, status }`; `GET .../jobs/.../status` mantém o mesmo formato de resposta; sem alteração de contrato JSON intencional neste PR. |

**Ressalvas operacionais:**

- **Sem E2E HTTP completo** (Next + `curl` em todos os passos): a cobertura cruzou revisão de rotas + execução com Prisma + runner do worker.
- **Batch** não validado pelo **fluxo HTTP completo** (criar lote → upload → `POST .../start` → download).
- **OPENAI_WHISPER** não exercitado nesta validação (depende de chave e rede); comportamento assumido equivalente ao código partilhado com o web.
- **Risco conhecido:** job `RUNNING` órfão se o worker morrer a meio do pipeline (sem reconciliação automática neste MVP).

---

## PR 6.2.1 — spine HTTP mínimo em `apps/api` (transcriptions / jobs)

### Objectivo

- Migrar para **`apps/api`** as rotas HTTP de **transcrição de job único** e **estado/retry**, com **`apps/web`** apenas a fazer **forward/proxy** para a API (mesmo padrão que `POST /api/projects/:id/media`).
- **Fora de escopo neste PR:** `/api/batch-jobs/*`, `POST /api/jobs/:jobId/reprocess-normalization`, fila externa, alteração de contrato público.

### Rotas migradas

| Método | Caminho | Dono |
|--------|---------|------|
| `GET` | `/api/jobs/:jobId/status` | `apps/api` |
| `POST` | `/api/projects/:projectId/transcriptions` | `apps/api` |
| `POST` | `/api/jobs/:jobId/retry` | `apps/api` |

Implementação na API: `apps/api/src/modules/transcription-jobs/` (`TranscriptionJobService`, `routes.ts`); registo em `apps/api/src/app.ts`.

### `apps/web`

- Handlers substituídos por **`forwardToApi`** (`apps/web/src/server/forward-to-api.ts`) com destino `API_BASE_URL` (predefinição `http://localhost:4000`).
- O contrato público (paths, métodos, status, JSON) mantém-se no **servidor da API**; o Next repassa a resposta.

### O que continua no Next (não migrado) após 6.2.1

- **`/api/batch-jobs/**`** — após **PR 6.3.1**–**6.3.4**, só **`GET .../download`** continua no Next (ver 6.3.x).

*(A rota `POST /api/jobs/:jobId/reprocess-normalization` foi migrada no **PR 6.2.2** — ver abaixo.)*

### Critério de pronto (6.2.1)

- As três rotas respondem pela **API**; o **web** só encaminha; **worker** inalterado no comportamento esperado; **sem** novas rotas além das listadas.

---

### Fechamento documental — validação operacional PR 6.2.1

**O que foi validado (smoke operacional):**

| Item | Resultado |
|------|-----------|
| **`POST /api/projects/:projectId/transcriptions`** | Validado **via `apps/web` (forward)** com `engine: MOCK` — resposta `{ jobId, status: "PENDING" }` e job criado na BD. |
| **`GET /api/jobs/:jobId/status`** | Validado — estado observado até conclusão (`DONE` no smoke). |
| **`POST /api/jobs/:jobId/retry`** | Validado — após forçar `FAILED` na BD, resposta `{ jobId, status: "PENDING" }` e reprocessamento. |
| **`apps/worker` como executor real** | Validado — transição `PENDING` → `DONE` com motor **MOCK** (pipeline fora do Next). |
| **Cues** | Validadas — cues persistidas após processamento (`subtitleCue` associadas ao `subtitleFile`). |
| **Contratos públicos** | Preservados no fluxo testado (paths/métodos/shapes alinhados ao desenho do PR 6.2.1). |

**Ressalvas:**

- **`API_BASE_URL`** no `apps/web` tem de apontar para a instância correcta da API; caso contrário o forward falha (ex. 502).
- **Body JSON inválido:** podem existir **pequenas diferenças** de mensagem/formato de erro entre Fastify (API) e o handler antigo no Next.
- **`OPENAI_WHISPER`** não foi exercitado nesta validação (depende de chave e rede).
- **Risco conhecido (PR 6.1):** job `RUNNING` órfão se o worker morrer a meio — **continua** fora do âmbito deste PR.

---

## PR 6.2.2 — `POST /api/jobs/:jobId/reprocess-normalization`

### Objectivo

- Migrar para **`apps/api`** a rota que **reaplica a normalização** sobre `rawResponse` já persistido (sem chamar transcrição / worker), com **`apps/web`** apenas em **forward/proxy**.
- **Fora de escopo:** `/api/batch-jobs/*`, fila externa, alteração de contrato público, outras rotas de jobs.

### Rota migrada

| Método | Caminho | Dono |
|--------|---------|------|
| `POST` | `/api/jobs/:jobId/reprocess-normalization` | `apps/api` |

Implementação: `apps/api/src/modules/transcription-jobs/` — `parseStoredRawResponseToTranscript`, `transcript-normalizer`, `cue-repository`, registo em `routes.ts` (junto às rotas 6.2.1).

### O que continua no Next (não migrado)

- **`/api/batch-jobs/**`** — parcialmente migrado nos **PR 6.3.1**–**6.3.4**; **`GET .../download`** continua no Next.

### Critério de pronto (6.2.2)

- A rota responde pela **API**; o **web** só encaminha; **worker** inalterado (esta rota não executa transcrição).

---

### Fechamento documental — PR 6.2.2

**Entregue:**

- **`POST /api/jobs/:jobId/reprocess-normalization`** implementada em **`apps/api`** com a mesma sequência de validações e o mesmo JSON de sucesso/erro que o handler legado no Next.
- **`apps/web`** expõe apenas **forward** (`forwardToApi`) para essa rota.
- **`/api/batch-jobs/*`** permanece **fora** do PR 6.2.2 (migração parcial em **PR 6.3.1** — create/get/start).

**Ressalvas operacionais:**

- **`API_BASE_URL`** no web tem de estar correcto para o forward.
- Smoke útil: job em **`DONE`** ou **`FAILED`** com **`rawResponse`** preenchido; estados **`PENDING`/`RUNNING`** devem devolver **409** como antes.
- **Risco conhecido (PR 6.1):** jobs `RUNNING` órfãos — **não** abordado aqui.

---

## PR 6.3.1 — `batch-jobs` (create + get + start)

### Objectivo

- Migrar para **`apps/api`** apenas o primeiro slice de **`/api/batch-jobs`**: criação do lote, leitura de estado e **`POST .../start`**, com **`apps/web`** a fazer **forward/proxy** (mesmo padrão que PR 6.2.1).
- **Fora de escopo neste PR:** `POST .../files`, `GET .../download`, `DELETE .../jobs`, `POST .../jobs/:jobId/retry`, fila externa, alteração de contrato público.

### Rotas migradas

| Método | Caminho | Dono |
|--------|---------|------|
| `POST` | `/api/batch-jobs` | `apps/api` |
| `GET` | `/api/batch-jobs/:batchId` | `apps/api` |
| `POST` | `/api/batch-jobs/:batchId/start` | `apps/api` |

Implementação na API: `apps/api/src/modules/batch-jobs/` (`BatchJobService`, `routes.ts`); registo em `apps/api/src/app.ts`.

### `apps/web`

- Handlers destas três rotas substituídos por **`forwardToApi`**; o header opcional **`x-openai-key`** é repassado no forward para alinhar com `POST .../start` na API.

### O que continua no Next (não migrado) após 6.3.1

*(O upload **`POST .../files`** migrou no **PR 6.3.2**; o **`POST .../retry`** no **PR 6.3.3**; o **`DELETE .../jobs`** no **PR 6.3.4**.)*

- **`GET /api/batch-jobs/:batchId/download`**

### Critério de pronto (6.3.1)

- As três rotas respondem pela **API**; o **web** só encaminha; contrato HTTP/JSON preservado; **sem** outras rotas de batch neste PR.

### Fechamento documental — validação operacional PR 6.3.1

**Validado (smoke):**

| Rota | `apps/api` (directo) | `apps/web` (forward) |
|------|----------------------|----------------------|
| `POST /api/batch-jobs` | Sim | Sim |
| `GET /api/batch-jobs/:batchId` | Sim | Sim |
| `POST /api/batch-jobs/:batchId/start` | Sim | Sim |

- **`POST .../start` duas vezes** no mesmo batch vazio: **200** em ambas as chamadas (API e web); comportamento **já existente no legado** (o handler HTTP devolve sempre `{ ok, started }`; `processBatchSequential` no-op quando o batch não está `PENDING`).
- Nestas **três** rotas, **`apps/web` actua só como forward** (`forwardToApi`); **download** continua **fora** do PR 6.3.1 (handlers no Next; **`POST .../files`** no **PR 6.3.2**; **`POST .../retry`** no **PR 6.3.3**; **`DELETE .../jobs`** no **PR 6.3.4**).

**Ressalvas:**

- **`API_BASE_URL`** no web tem de apontar para a instância correcta da API; caso contrário o forward falha (ex. **502**).
- **`POST /api/batch-jobs`** com **`Content-Type: application/json`** e corpo **JSON inválido**: o **Fastify** pode responder **400** no parser **antes** do handler; o legado no Next **não** lia o body — possível pequena divergência nesse canto.

---

## PR 6.3.2 — `POST /api/batch-jobs/:batchId/files`

### Objectivo

- Migrar **`POST /api/batch-jobs/:batchId/files`** para **`apps/api`** (dono oficial), com **`apps/web`** apenas **forward multipart** para a mesma rota na API.
- **Ponto crítico:** o forward **não** pode usar `request.text()` — **`forwardMultipartToApi`** repassa **`Content-Type` com boundary**, **`body: request.body`** (stream) e **`duplex: 'half'`** no `fetch` (Node 18+); sem isto o Next devolvia **500** no multipart.
- **Fora de escopo neste PR:** `GET .../download`, `DELETE .../jobs`, `POST .../jobs/:jobId/retry`, fila externa, alteração de contrato público.

### Rota migrada

| Método | Caminho | Dono |
|--------|---------|------|
| `POST` | `/api/batch-jobs/:batchId/files` | `apps/api` |

Implementação: `BatchJobService.addFileFromUpload` + rota em `apps/api/src/modules/batch-jobs/routes.ts`; **`forwardMultipartToApi`** em `apps/web/src/server/forward-to-api.ts`.

### O que continua no Next (não migrado) após 6.3.2

*(O **`POST .../jobs/:jobId/retry`** migrou no **PR 6.3.3**; o **`DELETE .../jobs`** no **PR 6.3.4**.)*

- **`GET /api/batch-jobs/:batchId/download`**

### Critério de pronto (6.3.2)

- A rota responde pela **API**; o **web** encaminha multipart sem regressão de contrato; job **`PENDING`** criado e ligado ao batch; **`totalFiles`** incrementado; **sem** outras rotas de batch neste PR.

### Fechamento documental — validação operacional PR 6.3.2

**Validado (smoke):** `POST /api/batch-jobs/:batchId/files` em **`apps/api`** e via **`apps/web`** (`forwardMultipartToApi`) — sucesso **201**; **404** batch inexistente; **400** sem `file`, MIME inválido, batch não `PENDING`, e (no web) `Content-Type` não multipart → **400** `multipart invalido` local.

**Correção integrada no PR:** forward multipart com **`duplex: 'half'`** + stream do body (não `arrayBuffer()`), alinhando API e web.

**Não simulado nesta sessão:** ficheiro acima do limite (smoke manual opcional com `MAX_FILE_SIZE_MB` ou ficheiro grande).

**Fora do PR 6.3.2 (confirmado):** **download**; **retry** no **PR 6.3.3**; **DELETE .../jobs** no **PR 6.3.4**.

**Ressalvas:** **`API_BASE_URL`** correcto; worker pode passar job a **`DONE`** rapidamente (validar **`PENDING`** logo após o insert se necessário).

---

## PR 6.3.3 — `POST /api/batch-jobs/:batchId/jobs/:jobId/retry`

### Objectivo

- Migrar **`POST /api/batch-jobs/:batchId/jobs/:jobId/retry`** para **`apps/api`** (dono oficial), com **`apps/web`** apenas **forward** (`forwardToApi`) e repasse de **`x-openai-key`**.
- **Fora de escopo neste PR:** `GET .../download`, `DELETE .../jobs`, outras rotas de batch, fila externa, alteração de contrato público.

### Rota migrada

| Método | Caminho | Dono |
|--------|---------|------|
| `POST` | `/api/batch-jobs/:batchId/jobs/:jobId/retry` | `apps/api` |

Implementação: `apps/api/src/modules/batch-jobs/routes.ts` — validação `batchId`/`jobId` e pertença ao batch, depois **`TranscriptionJobService.retry`**; **`forwardToApi`** no web.

### O que continua no Next (não migrado) após 6.3.3

*(O **`DELETE .../jobs`** migrou no **PR 6.3.4**.)*

- **`GET /api/batch-jobs/:batchId/download`**

### Critério de pronto (6.3.3)

- A rota responde pela **API**; o **web** só encaminha; contrato HTTP/JSON alinhado ao legado; **sem** outras rotas de batch neste PR.

### Fechamento documental — validação operacional PR 6.3.3

**Validado na `apps/api` (smoke):**

- Job **FAILED** no batch correcto → **200** com `{ ok, jobId }`.
- Job **inexistente** ou **batchId** que não corresponde ao job → **404** `Job nao encontrado neste batch`.
- Estado inválido (ex.: não **FAILED**) → **400** com a mensagem do `TranscriptionJobService.retry`.
- Após retry bem-sucedido, o job volta a **`PENDING`** na BD (observável via Prisma).
- Header **`x-openai-key`** enviado: não quebra o fluxo (o serviço ignora a chave para este caminho, como no legado).

**Não validado nesta sessão:**

- **`apps/web`** via forward (**`:3000`** não estava acessível) — falta smoke com Next a correr e **`API_BASE_URL`** correcto.
- **Worker parado / activo** (progressão **PENDING** → **RUNNING**/**DONE**) — smoke manual adicional.

**Conclusão:**

- **PR 6.3.3** considerado **fechado ao nível da API** para os cenários acima.
- **Fechamento operacional completo** (paridade **web** + confirmação **worker**) **pendente** de smoke adicional.

---

## PR 6.3.4 — `DELETE /api/batch-jobs/:batchId/jobs`

### Objectivo

- Migrar **`DELETE /api/batch-jobs/:batchId/jobs`** para **`apps/api`** (dono oficial), com **`apps/web`** apenas **forward** (`forwardToApi`).
- **Ponto crítico:** corpo JSON (`jobIds`) e **`Content-Type`** no forward — quando o cliente não envia `Content-Type` num **DELETE** com body, o Next predefine **`application/json`** ao reencaminhar (ver `forward-to-api.ts`).
- **Fora de escopo neste PR:** `GET .../download`, outras rotas de batch, fila externa, alteração de contrato público.

### Rota migrada

| Método | Caminho | Dono |
|--------|---------|------|
| `DELETE` | `/api/batch-jobs/:batchId/jobs` | `apps/api` |

Implementação: `BatchJobService.removeJobsFromBatch` + rota em `apps/api/src/modules/batch-jobs/routes.ts`; **`forwardToApi`** no web.

### O que continua no Next (não migrado) após 6.3.4

- **`GET /api/batch-jobs/:batchId/download`**

### Critério de pronto (6.3.4)

- A rota responde pela **API**; o **web** só encaminha; contrato HTTP/JSON alinhado ao legado; **`totalFiles`** e remoções **PENDING**/**FAILED** coerentes; **sem** outras rotas de batch neste PR.

### Fechamento documental — validação PR 6.3.4

**Validado em `apps/api` (smoke directo, sem `apps/web`):**

| Cenário | Resultado observado |
|---------|---------------------|
| Remoção de job **PENDING** | **200** `{"removed":1,"skipped":0}` |
| Remoção de job **FAILED** | **200** `{"removed":1,"skipped":0}` |
| Batch **inexistente** | **404** `{"error":"Batch nao encontrado"}` |
| **`jobIds` vazio** (`[]`) | **400** `{"error":"jobIds e obrigatorio"}` |
| **JSON inválido** (com `Content-Type: application/json`) | **400** (parser Fastify) |
| Jobs **RUNNING** / **DONE** no pedido | **200** `{"removed":0,"skipped":2}` (contam como removidos só **PENDING**/**FAILED**) |
| **Job de outro batch** no body | **200** `{"removed":0,"skipped":1}` |

- **`removed` / `skipped`:** coerentes com a regra de negócio (remoção efectiva só para **PENDING** ou **FAILED**; restantes entram em `skipped`).
- **`totalFiles` no `BatchJob`:** decremento verificado na BD após remoções bem-sucedidas.
- **Ficheiro em disco:** quando o projecto tinha **`storageKey`**, o ficheiro correspondente em `public/uploads/media/...` deixou de existir após a remoção.
- **`GET /api/batch-jobs/:batchId/download`:** na altura do PR 6.3.4 ainda estava no Next; migrado depois no **PR 6.3.5** (último slice de batch-jobs).

**Não validado nesta sessão:**

- **`apps/web`** via **`:3000`** (forward) — ambiente Next **indisponível**; não foi possível confirmar paridade HTTP/corpo com a API.

**Conclusão:**

- **PR 6.3.4** considerado **fechado ao nível da API** para os itens acima.
- **Paridade operacional completa** (**web** + forward **DELETE** com body JSON) **pendente** de um **smoke curto** com Next a correr e **`API_BASE_URL`** correcto.

---

## PR 6.3.5 — `GET /api/batch-jobs/:batchId/download` (último slice de `batch-jobs`)

### Objectivo

- Migrar **`GET /api/batch-jobs/:batchId/download`** para **`apps/api`** (dono oficial), com **`apps/web`** apenas **forward/proxy binário** para a mesma rota na API.
- **Ponto crítico:** o forward **não** pode usar **`upstream.text()`** na resposta de sucesso (ZIP binário) — **`forwardBinaryToApi`** em `apps/web/src/server/forward-to-api.ts` usa **`arrayBuffer()`** e repassa **`Content-Type`**, **`Content-Disposition`**, **`Cache-Control`** (e **`Content-Length`** quando presente). Erros **400**/**404** em JSON continuam a ser repassados como corpo UTF-8 com o `content-type` devolvido pela API.
- **Fora de escopo:** novos formatos além de SRT no ZIP, streaming optimizado, MinIO, alteração de contrato público.

### Rota migrada

| Método | Caminho | Dono |
|--------|---------|------|
| `GET` | `/api/batch-jobs/:batchId/download` | `apps/api` |

Implementação: `BatchJobService.buildZipForDoneJobs` (portado do legado) + rota em `apps/api/src/modules/batch-jobs/routes.ts`; dependência **`adm-zip`** na API; **`formatSrt`** em `apps/api/src/modules/projects/srt/format-srt.ts`.

### `apps/web`

- Handler do download substituído por **`forwardBinaryToApi`**; removido **`buildZipForDoneJobs`** de `BatchJobService` no web (lógica única na API).

### Estado de `batch-jobs` após 6.3.5

- **Último slice:** com este PR, **todas** as rotas HTTP de **`/api/batch-jobs/*`** relevantes ao fluxo actual estão migradas para **`apps/api`** com forward no Next; **não** fica nenhuma rota de batch-jobs só no handler Next por omissão (excepto notas históricas nas secções anteriores deste documento).

### Critério de pronto (6.3.5)

- **`GET .../download`** responde pela **API** (**200** ZIP / **400** / **404**) com o mesmo contrato observável que o legado.
- **`apps/web`** encaminha via **`forwardBinaryToApi`** sem corromper bytes.
- Documentação actualizada (esta secção).

### Fechamento documental — validação operacional PR 6.3.5

**Validado:**

| Escopo | Resultado |
|--------|-----------|
| **`GET .../download` em `apps/api`** (`:4000`) | **200** ZIP com jobs **DONE** (SRT); **404** batch inexistente; **400** sem jobs DONE para exportar. |
| **`GET .../download` via `apps/web`** (`forwardBinaryToApi`, `:3000`) | Mesmos **status** e corpos de erro JSON **idênticos** à API nos cenários testados. |
| **Batch inexistente** | **404** `{"error":"Batch nao encontrado"}` (API e web). |
| **Batch sem jobs DONE** | **400** `{"error":"Nenhum job concluido para exportar"}` (API e web). |
| **Batch misto** (DONE + não-DONE) | Só entradas dos jobs **DONE** no ZIP (ficheiros `.srt` correspondentes). |

**Headers no sucesso (200, ZIP):** **`Content-Type`** (`application/zip`), **`Content-Disposition`** (`attachment; filename="legendas-XXXXXXXX.zip"`), **`Cache-Control`** (`no-store`), **`Content-Length`** quando aplicável — coerentes entre API e resposta reencaminhada pelo web (o Next pode acrescentar **`vary`** próprio; não afecta o contrato do download).

**Observação — SHA256 do ficheiro `.zip`:** o hash do ficheiro ZIP pode **divergir** entre uma chamada directa à API e uma via web quando são **dois pedidos distintos** (cada um gera um ZIP novo; metadados do contentor ZIP podem variar). Nesta fase, a equivalência correcta foi validada pelo **conteúdo descomprimido** / **payload útil** (entradas e bytes dos `.srt`), não apenas pelo SHA256 do `.zip` entre duas gerações.

**Conclusão:** **PR 6.3.5 fechado.**

**Seguinte:** inventário pós-Bloco 6 e plano do **Bloco 7** (cues / subtitle-files) — ver **`docs/migration/bloco-7.md`**.
