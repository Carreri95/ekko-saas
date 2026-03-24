# Bloco 3 — núcleo técnico `Project` (editor/transcrição)

## Escopo exato do Bloco 3

Migrar para `apps/api` o modelo Prisma `Project` (projeto técnico de legenda/transcrição, **não** `DubbingProject`), **por fases**:

- Núcleo: `POST /api/projects`, `GET /api/projects/:id` (PR 3.1)
- Leitura de cues: `GET /api/projects/:id/cues` (PR 3.2)
- Export SRT: `GET /api/projects/:id/export/srt` (PR 3.3)

Manter **compatibilidade temporária** em `apps/web` via forward para `apps/api` nas rotas migradas.

**URLs para não confundir com estúdio:** `Project` técnico = `/api/projects/*` · `DubbingProject` = `/api/dubbing-projects/*`.

## PR 3.1 — o que entrou neste PR

- Módulo mínimo `apps/api/src/modules/projects/`:
  - `service.ts` — lógica equivalente às rotas Next anteriores
  - `routes.ts` — `POST /api/projects`, `GET /api/projects/:id`
  - `subtitle-file-queries.ts` — duplicado temporário de `findLatestSubtitleFileForProject`
- Infraestrutura reutilizável em `apps/api`:
  - `src/infrastructure/demo-user.ts` — `getDefaultUserId` (email demo)
  - `src/infrastructure/prisma-errors.ts` — `isDatabaseConnectionError`
- Registo das rotas em `apps/api/src/app.ts`
- `apps/web/app/api/projects/route.ts` — forward `POST` → `apps/api`
- `apps/web/app/api/projects/[id]/route.ts` — forward `GET` → `apps/api`

## PR 3.2 — o que entrou neste PR

- `apps/api`: `GET /api/projects/:id/cues` (mesma lógica que o handler Next legado)
- `apps/web/app/api/projects/[id]/cues/route.ts` — forward `GET` → `apps/api`

## PR 3.3 — o que entrou neste PR

- `apps/api`: `GET /api/projects/:id/export/srt` (texto SRT + headers `Content-Type`, `Content-Disposition`, `Cache-Control` como no legado)
- Helpers SRT duplicados temporariamente em `apps/api/src/modules/projects/srt/` (`time.ts`, `format-srt.ts`)
- `apps/web/app/api/projects/[id]/export/srt/route.ts` — forward `GET` → `apps/api` (repasse de headers relevantes para o download)

## O que continua explicitamente fora (até PR futuro)

Rotas sob `apps/web/app/api/projects/[id]/` ainda **não** migradas para `apps/api`:

- `POST .../media`
- `POST .../transcriptions`

Também fora de escopo: worker, MinIO, MediaAsset, transcription pesada, reorganização de outros domínios.

## Regra operacional

- Schema Prisma oficial do backend novo continua a ser `apps/api/prisma/schema.prisma` (herdado do Bloco 2).
