# Storage S3-compatible (MinIO em desenvolvimento)

Este documento fixa convenções da **fase 1** do Bloco 4: infra local e contratos escritos. **Nenhuma rota de produto depende destes valores ainda.**

## MinIO em desenvolvimento local

| Item | Valor (dev) |
|------|----------------|
| Imagem | `minio/minio` (ver `infra/docker/docker-compose.dev.yml`) |
| **API S3** (SDKs, presigned URLs) | `http://localhost:9000` (mapeamento do contentor) |
| **Consola web** | `http://localhost:9001` |
| Utilizador root (dev) | `minioadmin` |
| Palavra-passe root (dev) | `minioadmin` |

**Atenção:** estas credenciais são **apenas para desenvolvimento local**. Não reutilizar em ambientes expostos nem em produção.

### Acesso a partir do host vs contentor

- API a correr **no host** (ex.: `npm run dev:api`): usar `S3_ENDPOINT=http://127.0.0.1:9000` (ou `localhost`).
- API a correr **dentro da mesma rede Docker** que o MinIO: usar o hostname do serviço, ex.: `http://minio:9000`.

## Buckets iniciais (convenção)

| Bucket | Uso previsto |
|--------|----------------|
| `subtitlebot-media` | Objetos estáveis (mídia definitiva, exports, derivados pretendidos como duráveis) |
| `subtitlebot-temp` | Uploads temporários, reprocessamento, artefactos com política de limpeza |

Os nomes vêm de `S3_BUCKET_MEDIA` e `S3_BUCKET_TEMP` (valores por defeito na tabela). O compose **não** cria buckets automaticamente; o bootstrap idempotente está em **`apps/api`** (`npm run storage:bootstrap`). Ver passo a passo em **`docs/runbooks/storage-local.md`**.

## Convenção de `objectKey` (rascunho v1)

Formato sugerido para objetos **não temporários**:

```
{env}/project/{projectId}/asset/{assetId}/{filenameSafe}
```

Exemplo de `env`: `dev`, `staging`, `prod`.

Para **temporários** (ex.: multipart em curso):

```
temp/{uploadId}/{partName}
```

`filenameSafe` deve ser normalizado (sem path traversal, caracteres problemáticos substituídos).

Estas regras serão aplicadas quando `MediaAsset` e os fluxos de upload estiverem implementados; até lá são apenas contratos de documentação.

## `POST /api/projects/:id/media` — ordem de operações (PR 5.3, estado transitório)

Fluxo **atual** no `apps/api` (multipart no servidor, sem presigned no browser):

1. Validar e gravar o ficheiro **no disco local** (`public/uploads/media` ou `MEDIA_STORAGE_DIR`).
2. Calcular `durationMs`, atualizar **`Project`** e **`SubtitleFile`** (como nos PRs anteriores).
3. **Replicação opcional** (MinIO / S3-compatible): se `S3_*` estiver **completo** e `checkStorageHealth()` indicar **OK**, executar **`PutObject`** no bucket `S3_BUCKET_MEDIA` com chave `media/v1/{projectIdSanitizado}/{storageKey}` (ver `buildRemoteObjectKey` em `project-media-minio-replication.ts`).
4. **`MediaAsset`:**
   - se o passo 3 **teve sucesso** e o insert remoto corre — registo com `storageProvider` **`s3-compatible`**, `bucket` / `objectKey` reais;
   - caso contrário — registo **local** (`bucket` sentinela `local`, `objectKey` = `storageKey`), como no PR 5.2.

**Estado transitório**

- O **produto** (editor, `GET .../audio`, transcriptions) continua a ler o **ficheiro local**; o objeto no MinIO é **réplica canónica** na BD para evolução futura (read path remoto, limpeza de disco, etc.).
- Falha na replicação **não** altera a resposta HTTP de sucesso do upload se o disco e a BD principal estiverem OK.

## `GET /api/subtitle-files/:id/audio` — ordem de leitura (PR 5.5)

1. Pedido HTTP na **URL pública** do Next (`/api/subtitle-files/:id/audio`) → **forward** para `apps/api` (mesmo path).
2. **`apps/api`:** carrega `SubtitleFile` por `id`; resolve ficheiro no **disco local** (candidatos alinhados ao legado + `../web/public/...` quando `cwd` é `apps/api` + `MEDIA_STORAGE_DIR` se definido).
3. Resposta **200** com bytes do ficheiro (**sem** `Range` nesta fase) ou **4xx/5xx** com JSON de erro coerente com o legado.
4. **MinIO / `GetObject`:** **não** entra neste PR; fallback remoto fica para **PR 5.5.1** se for necessário.

## Modelo Prisma `MediaAsset` (PR 4.3)

Tabela canónica para **metadados** de ficheiros armazenados em object storage (S3-compatible). Nesta fase é apenas **schema + migration**: nenhuma rota de produto cria ou lê `MediaAsset`; o upload local do Next (`public/uploads`) mantém-se.

| Campo | Tipo (Prisma) | Notas |
|-------|----------------|-------|
| `id` | `String` (cuid) | Identificador do registo. |
| `kind` | `MediaAssetKind` | `AUDIO`, `VIDEO`, `OTHER`. |
| `status` | `MediaAssetStatus` | `PENDING`, `READY`, `FAILED`, `ARCHIVED`. |
| `visibility` | `MediaVisibility` | `PRIVATE`, `INTERNAL`, `PUBLIC`. |
| `storageProvider` | `String` | Valor livre nesta fase (ex.: `s3-compatible`, `local`). |
| `bucket` | `String` | Nome do bucket. |
| `objectKey` | `String` | Chave do objeto no storage. |
| `originalFilename` | `String` | Nome de ficheiro original. |
| `mimeType` | `String?` | Opcional. |
| `sizeBytes` | `BigInt?` | Tamanho em bytes. |
| `checksumSha256` | `String?` | Hash opcional para integridade. |
| `createdAt` / `updatedAt` | `DateTime` | Auditoria. |

**Restrições / índices:** `@@unique([bucket, objectKey])`; índices em `status` e `kind`.

**Relacionamentos:** nenhum FK nesta fase — evita acoplar cedo a `Project` / `User` até os fluxos de upload estarem definidos.

## Variáveis de ambiente (apps/api)

Ver `apps/api/.env.example`. Prefixo sugerido:

| Variável | Descrição |
|----------|-----------|
| `S3_ENDPOINT` | URL base do endpoint S3 (MinIO API) |
| `S3_REGION` | Região para o SDK (ex.: `us-east-1`; MinIO frequentemente ignora, mas o cliente AWS exige valor) |
| `S3_ACCESS_KEY` | Chave de acesso (no dev: alinhada ao root MinIO) |
| `S3_SECRET_KEY` | Segredo |
| `S3_BUCKET_MEDIA` | Nome do bucket de média definitiva |
| `S3_BUCKET_TEMP` | Nome do bucket temporário |
| `S3_FORCE_PATH_STYLE` | `true` recomendado para MinIO |

Sem `S3_ENDPOINT`, a API **não** tenta ligar ao MinIO; `GET /health/storage` devolve `storage: "disabled"` com HTTP 200.

Com `S3_ENDPOINT` e credenciais, `GET /health/storage` executa `ListBuckets` para validar ligação (HTTP 200 com lista de buckets ou 503 se falhar).

## Estrutura em `apps/api` (PR 4.2 + 4.3 + 4.4)

| Ficheiro / comando | Função |
|--------------------|--------|
| `prisma/schema.prisma` | Inclui modelo `MediaAsset` e enums (PR 4.3). |
| `prisma/migrations/` | Migration `20260323130000_add_media_asset` (PR 4.3). |
| `prisma.config.ts` | Prisma 7: datasource `DATABASE_URL`, pasta de migrations, carga de `.env`. |
| `src/infrastructure/storage/storage-config.ts` | `loadStorageConfig()` — envs e estados disabled / misconfigured / ready |
| `src/infrastructure/storage/s3-client.ts` | `createS3Client(config)` |
| `src/infrastructure/storage/ensure-buckets.ts` | `ensureStorageBuckets()` — criação idempotente dos buckets (PR 4.4) |
| `src/scripts/bootstrap-storage-buckets.ts` | CLI: `npm run storage:bootstrap` |
| `src/infrastructure/storage/storage-health.service.ts` | `checkStorageHealth()` — `ListBuckets` |
| `src/routes/health-storage.ts` | Regista `GET /health/storage` |
| `src/modules/projects/project-media-minio-replication.ts` | PR 5.3: `PutObject` + `MediaAsset` remoto após upload local |
| `src/modules/projects/media-asset-current.ts` | PR 5.4: regra de **asset corrente** (`Project.storageKey` + identidades local/remota esperadas) |
| `src/modules/projects/media-asset-inconsistency.ts` | PR 5.4: deteção de inconsistências (sem side effects) |
| `src/scripts/reconcile-media-assets.ts` | PR 5.4: `npm run media:reconcile` — reconciliação de `subtitleFileId` (dry-run / apply) |
| `src/modules/subtitle-files/audio-resolve-path.ts` | PR 5.5: resolução de path local para áudio |
| `src/modules/subtitle-files/subtitle-file-audio.service.ts` | PR 5.5: serving de `GET /api/subtitle-files/:id/audio` |
| `src/modules/subtitle-files/routes.ts` | PR 5.5: registo da rota de áudio |

O módulo **projects** usa a infraestrutura de storage **apenas** para replicação opcional em `POST /api/projects/:id/media`. O **read path** de áudio do editor passou para `apps/api` no PR 5.5, mantendo leitura no **disco local**.

## Asset corrente e reconciliação (PR 5.4)

- **Fonte de verdade (fase actual):** `Project.storageKey`.
- **Asset corrente:** o `MediaAsset` cujo par `(bucket, objectKey)` coincide com o espelho **local** esperado (`local` / `local` / `storageKey`) **ou** com o **remoto** esperado (`s3-compatible` / `S3_BUCKET_MEDIA` / `media/v1/{projectIdSanitizado}/{storageKey}`), com desempate `createdAt` desc. e depois `id` desc.
- **`SubtitleFile.wavPath`:** consistência secundária (esperado `/uploads/media/{storageKey}`); divergências são reportadas, não substituem `storageKey`.
- **Contrato HTTP** do upload: inalterado pela reconciliação; reconciliação não apaga histórico de `MediaAsset` nem faz cleanup destrutivo.
- **GET áudio (PR 5.5):** boundary em `apps/api`, URL pública inalterada; leitura continua no **disco local** (MinIO não é read path nesta fase).

Ver **`docs/runbooks/media-asset-reconcile.md`**.

## Compatibilidade

- MinIO expõe API **compatível com S3**; em uso: **AWS SDK for JavaScript v3** (`@aws-sdk/client-s3`) com `endpoint` e `forcePathStyle`.

## Relação com o produto atual

- O upload de mídia passa pelo **`apps/api`** (`POST /api/projects/:id/media`); o Next faz **forward**.
- A **leitura** de áudio no editor usa **`GET /api/subtitle-files/:id/audio`** — implementação canónica em **`apps/api`** (PR 5.5); o Next faz **forward**; os bytes vêm ainda do **ficheiro local** resolvido a partir de `wavPath`.
- Com PR 5.3, pode existir **réplica** do mesmo blob no MinIO; o consumo de produto **mantém-se** no local nesta fase.
- Com PR 5.4, `MediaAsset` pode ter **`subtitleFileId`** opcional (FK ao `SubtitleFile` ativo após upload); leitura de produto **continua** no ficheiro local.
