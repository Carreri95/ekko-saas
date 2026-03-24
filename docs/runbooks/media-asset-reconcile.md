# Runbook — reconciliação `MediaAsset` (PR 5.4)

## Quando usar

- Após deploy da migration `subtitleFileId` em `MediaAsset`.
- Para auditar inconsistências entre `Project.storageKey`, `MediaAsset` e `SubtitleFile`.
- Antes de PRs futuros que leiam `MediaAsset` no read path.

## Comandos

Na pasta **`apps/api`** (ou na raiz do monorepo com o script equivalente):

```bash
# Simulação (sem escrita) — por defeito quando não se passa --apply
npm run media:reconcile -- --dry-run

# Persistir vínculos corrigidos
npm run media:reconcile -- --apply
```

Com `npx` a partir de `apps/api`:

```bash
npx tsx src/scripts/reconcile-media-assets.ts --dry-run
npx tsx src/scripts/reconcile-media-assets.ts --apply
```

## O que o script faz

1. Lista inconsistências principais (só leitura): projecto com `storageKey` sem asset corrente; `wavPath` ≠ `/uploads/media/{storageKey}`; vínculos `subtitleFileId` suspeitos; múltiplos candidatos correntes.
2. **Plano:** para cada projecto com `storageKey`, localiza o `SubtitleFile` ativo (`updatedAt` desc.) e o asset **corrente** (regra em `media-asset-current.ts`).
3. **Apply:** define `subtitleFileId` no asset corrente para o `SubtitleFile` ativo; remove `subtitleFileId` de outros `MediaAsset` que ainda apontem para esse `SubtitleFile` (histórico).

## O que o script não faz

- Não apaga linhas `MediaAsset`.
- Não remove ficheiros locais nem objetos MinIO.
- Não altera `GET /api/subtitle-files/:id/audio` nem `/transcriptions`.

## Asset corrente (resumo)

- Fonte primária: **`Project.storageKey`**.
- Candidatos: identidade local `(local, local, storageKey)` **ou** remota `(s3-compatible, bucket esperado, media/v1/.../storageKey)`.
- Desempate: `createdAt` mais recente; em empate, `id` lexicograficamente maior.
