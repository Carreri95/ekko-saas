# Bloco 5 — migração do domínio `/media`

## Objetivo

Migrar o upload de mídia de projeto para **`apps/api`**, com storage compatível com o legado e evolução futura (MinIO, `MediaAsset`), **sem** regressão de contrato nem do editor.

## PR 5.1 — boundary HTTP de `POST /api/projects/:id/media`

**Entregue neste PR:**

- **`apps/api`** expõe **`POST /api/projects/:id/media`** com o mesmo comportamento observável que o handler Next anterior:
  - multipart `file`, validação MIME/tamanho, gravação em disco no diretório equivalente a `apps/web/public/uploads/media` (por defeito: path relativo ao cwd `apps/api` → `../web/public/uploads/media`, ou override com `MEDIA_STORAGE_DIR`).
  - Atualização de `Project` (`storageKey`, `mediaKind: audio`, `durationMs`) e `SubtitleFile` (criar/atualizar o mais recente com `wavPath` `/uploads/media/...`).
  - Resposta JSON: `storageKey`, `sizeBytes`, `durationMs`, `subtitleFileId`, `publicPath`.
- **`apps/web`**: `app/api/projects/[id]/media/route.ts` passou a ser **forward** para `apps/api` (mesma URL pública no Next), preservando status e corpo.
- Dependências na API: `@fastify/multipart`, `music-metadata` (duração), serviços espelhados do web (`MediaStorageService`, `audio-duration`, limites `MAX_FILE_SIZE_MB`).

**Explicitamente fora deste PR (próximos PRs do bloco):**

- **`POST /api/projects/:id/transcriptions`** e pipeline de jobs — **não** migrados.
- **MinIO / presigned upload** no fluxo de negócio — **não** obrigatórios; `GET /health/storage` continua independente.
- **`MediaAsset`** no caminho de upload — **não** integrado (modelo existe na BD desde o Bloco 4; uso em negócio fica para PRs seguintes).
- **`GET /api/subtitle-files/:id/audio`** — **não** alterado.
- **Batch** (`/api/batch-jobs/.../files`) — **não** no escopo do PR 5.1.
- **Worker** funcional — **não** introduzido.
- **Cleanup** de ficheiros locais antigos — **não** feito.

## Critério de pronto (Bloco 5 — parcial, pós PR 5.1)

- `POST /api/projects/:id/media` responde em **`apps/api`**.
- O Next continua a expor **`/api/projects/:id/media`** via forward, sem mudança de contrato para o cliente.
- Documentação deste ficheiro atualizada.

## Validação rápida (PR 5.1)

1. Postgres + API (`npm run dev:api`) e Web (`npm run dev:web`); `API_BASE_URL` no web alinhado (default `http://localhost:4000`).
2. Criar projeto (ex.: `POST /api/projects` ou UI).
3. `curl` ou cliente multipart para `POST http://localhost:3000/api/projects/<id>/media` (ou porta do Next) com campo `file` — esperado **200** e JSON com `storageKey`, `publicPath`, etc.
4. Repetir contra `POST http://localhost:4000/api/projects/<id>/media` diretamente — mesmo resultado.
5. Confirmar ficheiro em `apps/web/public/uploads/media/` e `GET /api/subtitle-files/<subtitleFileId>/audio` a servir (rota não migrada neste PR).

## Fecho documental (PR 5.1) — validação manual E2E

Registo do resultado de testes manuais (API em `:4000`, Next em `:3000` para o forward), sem automatização adicional.

**Validado — fluxo feliz**

- **`apps/api`**: `POST /api/projects/:id/media` com ficheiro de áudio válido (WAV; MIME explícito no cliente de teste quando necessário) → **200**, payload com `storageKey`, `sizeBytes`, `durationMs`, `subtitleFileId`, `publicPath`.
- **`apps/web`**: mesmo endpoint via forward → **200**, **mesmo shape** de resposta que na API direta.

**Validado — persistência e modelo**

- **Disco**: ficheiro presente em `apps/web/public/uploads/media/<storageKey>` (nome alinhado ao `storageKey` devolvido).
- **`Project`**: `storageKey`, `mediaKind` áudio, `durationMs` atualizados (`GET /api/projects/:id`).
- **`SubtitleFile`**: criado ou atualizado (último por projeto); `wavPath` coerente com `GET /api/subtitle-files/:id` (Next).

**Validado — coerência de campos**

- **`durationMs`**: calculado quando o parser consegue extrair duração (ex.: WAV de teste).
- **`publicPath` e `storageKey`**: `publicPath` = `/uploads/media/` + `storageKey`.

**Validado — erros principais** (respostas alinhadas entre API direta e forward, onde aplicável)

- `projectId` inexistente → **404**, `Projeto nao encontrado`.
- Pedido **sem** campo `file` → **400**, `Campo file e obrigatorio`.
- **Multipart inválido** (ex.: corpo JSON) → **400**, `multipart invalido`.
- **MIME** não permitido (ex.: `text/plain`) → **400**, `MIME type de audio nao permitido`.

**Ressalvas (não simuladas nesta validação)**

- **Limite de tamanho** (`MAX_FILE_SIZE_MB`): não exercitado (implicaria reinício da API com limite baixo).
- **Falha de escrita em disco** (disco cheio, permissões): não simulada.

## PR 5.2 — `MediaAsset` em dual-write (storage local; opção A)

**Decisão:** **opção A** — o write path físico continua em `apps/web/public/uploads/media` (ou `MEDIA_STORAGE_DIR`); **não** se escreve em MinIO no fluxo de negócio deste PR.

**Papel de `MediaAsset` aqui:** espelho canónico de cada upload bem-sucedido de `POST /api/projects/:id/media`: metadados alinhados ao ficheiro gravado (`kind`, `status`, `visibility`, `storageProvider`, `bucket`, `objectKey`, `mimeType`, `sizeBytes`, `checksumSha256`, etc.).

**Convenção bucket / objectKey (ficheiros locais nesta fase)**

| Campo | Valor |
|--------|--------|
| `storageProvider` | `"local"` |
| `bucket` | Sentinela fixa **`local`** (evita colisão com nomes de buckets S3/MinIO reais). |
| `objectKey` | Igual ao **`storageKey`** do upload (nome opaco no disco, ex. `UUID.ext`), único por upload dentro do bucket sentinela. |

`@@unique([bucket, objectKey])` no Prisma garante unicidade por par; cada novo upload gera um `storageKey` novo.

**Política de falha:** se a criação de `MediaAsset` falhar, o **upload legado** (disco + `Project` + `SubtitleFile`) **mantém-se** bem-sucedido; regista-se **log** em consola (`[MediaAsset dual-write] ...`). `MediaAsset` **não** é hard requirement nesta fase.

**Contrato HTTP:** inalterado (mesmo shape de resposta que no PR 5.1). O forward no **apps/web** não precisou de alterações.

**Explicitamente fora deste PR (próximos PRs)**

- Write path **MinIO** / objeto remoto no upload de produto.
- **FK** opcional `MediaAsset` ↔ `Project` (não introduzida para não ampliar escopo).
- **`POST /transcriptions`**, **worker**, **`GET .../audio`** para MinIO.
- Limpeza de órfãos ou reconciliação batch entre disco e `MediaAsset`.

**Critério de pronto (PR 5.2)**

- Upload bem-sucedido: mesmo comportamento externo que no PR 5.1.
- Para cada upload bem-sucedido, deve existir um registo **`MediaAsset`** coerente (na ausência de falha de BD).
- Sistema continua dependente apenas do storage local para servir o ficheiro.

**Risco residual documentado:** possível **inconsistência transitória** (ficheiro no disco sem linha `MediaAsset` se o insert falhar); recuperação/reconciliação fica para fases posteriores.

## PR 5.3 — espelhamento servidor → MinIO (ficheiro local preservado)

**Papel deste PR:** após o upload local bem-sucedido (`POST /api/projects/:id/media`), **replicar o mesmo blob** para o bucket configurado em `S3_BUCKET_MEDIA` quando `S3_*` está **completo** e `checkStorageHealth()` reporta **modo `ok`**; em seguida criar **`MediaAsset`** com metadados **remotos** canónicos (`storageProvider` `s3-compatible`, `bucket` / `objectKey` reais).

**O que continua local nesta fase**

- Gravação em disco (`MediaStorageService`), `Project` / `SubtitleFile`, resposta HTTP e **`wavPath`** — **inalterados**.
- **Leitura** (`GET /api/subtitle-files/:id/audio` no Next) e **transcriptions** — continuam a usar o **ficheiro local**; MinIO **não** é o read path de produto.

**Convenção `objectKey` remota (PR 5.3)**

```
media/v1/{projectIdSanitizado}/{storageKey}
```

- `storageKey` é o nome opaco no disco (ex. `UUID.ext`).
- `projectId` sanitizado (caracteres seguros) para evitar path traversal.

**Política de falha**

- **MinIO não configurado** (`loadStorageConfig` ≠ `ready`): **não** há `PutObject`; cria-se apenas o espelho **local** (`MediaAsset` com `bucket` sentinela `local`, como no PR 5.2).
- **Storage remoto não saudável** (`checkStorageHealth` ≠ `ok` com modo `ok`): idem — fallback **local**; log `[PR 5.3] Storage remoto indisponível...`.
- **PutObject falha** (rede, permissões, bucket em falta): fallback **local**; log `[PR 5.3] PutObject falhou...`.
- **Insert `MediaAsset` remoto falha após PutObject bem-sucedido:** log; fallback **local** (possível objeto órfão no bucket — ver risco residual).
- Em todos os casos o **POST /media** devolve **200** com o mesmo JSON de sucesso se o upload local e a atualização principal tiverem sido concluídos.

**MinIO não é hard requirement** neste PR: o cliente não depende de MinIO para sucesso do upload.

**Explicitamente fora deste PR**

- Presigned upload no browser; alteração do contrato HTTP; **GET** `/subtitle-files/.../audio` a partir de MinIO; **transcriptions**; worker; cleanup de ficheiros locais ou duplicados no bucket.

**Critério de pronto (PR 5.3)**

- Com `S3_*` válido e MinIO acessível: ficheiro local + objeto no bucket + `MediaAsset` com `bucket`/`objectKey` remotos.
- Sem `S3_*` ou com falha remota: comportamento equivalente ao **PR 5.2** para o cliente.
- Contrato HTTP inalterado.

## PR 5.4 — consolidação dual-write + modelo + observabilidade/reparação

**Objetivo:** vínculo canónico opcional **`MediaAsset.subtitleFileId` → `SubtitleFile`**, utilitários para o **asset corrente** (regra centrada em `Project.storageKey`), deteção de inconsistências e script de reconciliação **idempotente** (`--dry-run` / `--apply`), **sem** alterar contratos HTTP nem o read path local.

**Regra de asset corrente (fase actual)**

- Fonte de verdade: **`Project.storageKey`** (`S`).
- Candidatos ao registo corrente:
  - **Local:** `storageProvider = "local"`, `bucket = "local"`, `objectKey = S`.
  - **Remoto:** `storageProvider = "s3-compatible"`, `bucket` = bucket esperado (`S3_BUCKET_MEDIA` / config), `objectKey = media/v1/{projectIdSanitizado}/S`.
- Desempate entre candidatos: `createdAt` mais recente; em empate, `id` lexicograficamente maior.
- **`SubtitleFile.wavPath`:** secundário — esperado `/uploads/media/S`; divergência é sinalizada, não substitui `storageKey`.

**Modelo**

- `MediaAsset.subtitleFileId` opcional, FK a `SubtitleFile` com `onDelete: SetNull`.
- `@@index([subtitleFileId])`.
- Histórico: **não** apagar linhas antigas de `MediaAsset`.

**Implementação (apps/api)**

- `src/modules/projects/media-asset-current.ts` — resolução do asset corrente.
- `src/modules/projects/media-asset-inconsistency.ts` — deteção (projecto sem asset corrente; `wavPath` vs `storageKey`; vínculos `subtitleFileId` incoerentes; múltiplos candidatos).
- `src/scripts/reconcile-media-assets.ts` — `npm run media:reconcile`.
- Logs JSON `[PR 5.4] MediaAsset canonical state` após `MediaAsset` criado com sucesso (modo `local` ou `s3-compatible`).

**Explicitamente fora deste PR**

- Migração do boundary HTTP de `GET /api/subtitle-files/:id/audio` para `apps/api` — **PR 5.5**.
- `/transcriptions`, worker funcional, presigned upload, cleanup destrutivo, alteração de shapes de resposta.

**Critério de pronto (PR 5.4)**

- Migration aplicada; novos uploads preenchem `subtitleFileId` quando o `MediaAsset` é criado.
- Utilitário de asset corrente e deteções principais disponíveis.
- Script de reconciliação com dry-run e apply documentado (`docs/runbooks/media-asset-reconcile.md`).
- Comportamento externo do produto inalterado.

**Fecho documental (PR 5.4) — validação manual**

- **Migration:** `prisma migrate deploy` sem erro; coluna `MediaAsset.subtitleFileId`, FK e índice confirmados na BD.
- **Dry-run:** `npm run media:reconcile -- --dry-run` executado; output coerente com a regra de asset corrente (`Project.storageKey`); plano de `set`/`clear` e inconsistências plausíveis.
- **Apply:** reconciliação aplicada com sucesso; dry-run repetido com plano vazio (`[]`).
- **Comportamento externo:** `POST /api/projects/:id/media` e `GET /api/subtitle-files/:id/audio` sem alteração observável (mesmo contrato; áudio servido como antes).

**Ressalva operacional (apply)**

- No teste, `npm run media:reconcile -- --apply` **não** repassou a flag `--apply` ao script (executou como dry-run).
- Comando funcional usado para apply: `npx tsx src/scripts/reconcile-media-assets.ts --apply` (a partir da pasta `apps/api`).

## PR 5.5 — read path / serving de áudio (`GET /api/subtitle-files/:id/audio`)

**Objetivo:** migrar **apenas** o boundary HTTP do serving de áudio para **`apps/api`**, preservando a **mesma URL pública** (`/api/subtitle-files/:id/audio`), o mesmo comportamento observável (status, corpo binário, JSON de erro, headers essenciais) e mantendo a leitura no **disco local** nesta fase.

**Implementação**

- **`apps/api`:** `GET /api/subtitle-files/:id/audio` — resolve path no disco (lógica alinhada ao handler Next legado + candidatos para `cwd` em `apps/api` e `MEDIA_STORAGE_DIR`), lê o ficheiro completo (**sem** `Range`), responde com `Content-Type`, `Content-Disposition`, `Cache-Control`, `Content-Length`.
- **`apps/web`:** `app/api/subtitle-files/[id]/audio/route.ts` passou a **forward** para `apps/api` (mesmo padrão que `POST .../media`).

**O que continua nesta fase**

- **Bytes servidos:** sempre a partir do **ficheiro local** (não há `GetObject` MinIO neste PR).

**Explicitamente fora deste PR**

- Fallback / leitura desde **MinIO** — **PR 5.5.1** (se aplicável).
- `/transcriptions`, worker funcional, `Range` / streaming parcial, presigned upload, cleanup de storage local.
- Alteração de `POST /api/projects/:id/media`.

**Critério de pronto (PR 5.5)**

- `apps/api` responde a `GET /api/subtitle-files/:id/audio`; Next faz forward sem mudar a URL pública.
- Editor continua a reproduzir áudio; erros e corpos alinhados ao legado.
