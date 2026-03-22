# Pipeline de transcrição automática — estado da implementação (MVP → escala)

Este documento cruza a **especificação técnica** da pipeline (domínios, módulos, endpoints, roadmap) com **o que já está no repositório**, o que ficou **parcial** e o que permanece **planejado (Fase 2+)**. Complementa o [ARCHITECTURE.md](./ARCHITECTURE.md) (MVP1 do editor), que não descrevia a camada de transcrição.

---

## 1. Princípio central (três domínios)

| Domínio | Implementação atual |
|--------|----------------------|
| **Armazenamento de mídia** | `web/src/server/transcription/media-storage.service.ts` — validação MIME/tamanho, `storageKey` opaco, disco em `public/uploads/media` (ou `MEDIA_STORAGE_DIR`). |
| **Orquestração de jobs** | `web/src/server/transcription/transcription-job.service.ts` — estados PENDING → RUNNING → DONE/FAILED, retry com backoff, processamento em **background na mesma instância** (`void` / assíncrono). |
| **Domínio de legendas** | Cues em **`SubtitleCue`** ligadas a **`SubtitleFile`** (não há tabela `cues` separada por projeto). `TranscriptionJob` referencia `subtitleFileId`. |

Comunicação por **contratos**: `TranscriptionAdapter`, `RawTranscript`, `NormalizedCue`, `CueRepository` — o editor **não** depende do JSON da OpenAI.

---

## 2. Checklist do MVP (especificação × código)

### Backend

| Item especificado | Estado | Notas |
|-------------------|--------|--------|
| MediaStorageService (MIME, tamanho, storageKey) | Feito | `MAX_FILE_SIZE_MB`, extensão por MIME. |
| Model + migration TranscriptionJob | Feito | Inclui `subtitleFileId`, `rawResponse` (JSON). |
| Model “Cue” com índices | Feito | **`SubtitleCue`** existente + `transcriptionJobId` opcional + índice `(subtitleFileId, startMs)`. |
| Interface TranscriptionAdapter | Feito | Retorno `{ transcript, rawResponse }` para persistir bruto. |
| OpenAIWhisperAdapter (`verbose_json`, segment timestamps) | Feito | `timestamp_granularities[]` = segment. |
| TranscriptNormalizer + `cleanText` | Feito | Testes Vitest em `transcript-normalizer.test.ts`. |
| TranscriptionJobService + retry | Feito | `MAX_TRANSCRIPTION_ATTEMPTS`, backoff. |
| CueRepository `saveBatch` em transação | Feito | `saveBatchForTranscription` (substitui cues do ficheiro no fluxo de transcrição). |
| Endpoints principais | Feito | Ver secção [Endpoints](#4-endpoints-implementados). |
| **POST reprocessar só normalização** | Feito | `POST /api/jobs/:jobId/reprocess-normalization` (usa `rawResponse`). |
| **GET projeto (metadados)** | Feito | `GET /api/projects/:id`. |
| **durationMs no projeto** | Feito | No upload de média via `music-metadata` (buffer). |
| **Limite HTTP alinhado ao tamanho máximo** | Feito | `next.config.ts` — `experimental.proxyClientMaxBodySize` e `serverActions.bodySizeLimit` derivados de `MAX_FILE_SIZE_MB`. |
| Logging estruturado nas transições | Parcial | JSON em `console.log` no job service; não há logger dedicado (Pino, etc.). |
| STORAGE_BUCKET / S3 / R2 | Não feito | MVP em disco local; extensível via `MEDIA_STORAGE_DIR` / futuro adapter de storage. |

### Frontend

| Item | Estado | Notas |
|------|--------|--------|
| Gerador em lote (ZIP) | Feito | `/gerar` — batch, mock/OpenAI, polling do batch, download ZIP (sem redirect ao editor). |
| Polling status (batch) | Feito | `GET /api/batch-jobs/:batchId/status`. |
| Polling status (job, API) | Feito | `GET /api/jobs/:jobId/status`. |
| FAILED + retry | Feito | Gerador: retry no batch; APIs: `POST /api/jobs/:jobId/retry`. |
| Fluxo UI “um ficheiro → editor” | Removido | A antiga `/transcribe` foi eliminada; o editor continua em `/subtitle-file-edit?subtitleFileId=`. |
| Editor com cues do servidor | Feito | `GET /api/subtitle-files/:id` no bootstrap + rotas cues. |

### Qualidade / ops

| Item | Estado |
|------|--------|
| MockAdapter | Feito |
| Testes TranscriptNormalizer (+ mock adapter, raw-response parse) | Feito |
| Variáveis `.env.example` | Feito | Inclui `DATABASE_URL`, `OPENAI_API_KEY`, limites, segurança, notas Vercel/proxy. |
| `npm run db:seed` / Prisma seed | Feito | Utilizador demo para `POST /api/projects`. |

---

## 3. O que a especificação pedia e como ficou na prática

### ProjectRepository

- **Especificação:** repositório dedicado para projetos e vínculos.
- **Código:** existe `web/src/server/transcription/project-repository.ts`, mas **várias rotas usam `prisma` diretamente** por simplicidade. Não bloqueia; é **refactor de consistência** para Fase 2.

### Tabela `cues` com `project_id`

- **Especificação:** cues com `project_id` + `job_id`.
- **Decisão:** cues permanecem em **`SubtitleCue`** com `subtitleFileId` + `transcriptionJobId` opcional — o editor já opera em **SubtitleFile + Cue[]**. Evita duplicar modelo e migrações pesadas no editor.

### Fila / worker (BullMQ, Inngest, etc.)

- **Especificação Fase 2:** jobs fora do processo HTTP.
- **Estado atual:** jobs disparam com **`void` na mesma instância** — adequado ao MVP; **não** há fila distribuída nem isolamento de worker.

### Segurança

- **MVP:** APIs sem utilizador final autenticado (utilizador demo no seed).
- **Produção:** `web/middleware.ts` opcional — `API_SECRET` (Bearer / `X-API-Key`) e `API_RATE_LIMIT_PER_MINUTE` por IP. **Atenção:** com `API_SECRET` ativo, o browser não envia o header por defeito; ver comentários em `.env.example` (proxy, sessão, NextAuth).

### Documentação

- **ARCHITECTURE.md:** ainda descreve sobretudo o MVP1 do editor; **não** lista a pipeline. Este ficheiro **`PIPELINE-TRANSCRICAO.md`** é a fonte para transcrição.
- Sugestão: no `ARCHITECTURE.md`, manter regras gerais e **linkar** para aqui (feito abaixo).

---

## 4. Endpoints implementados (prefixo `/api`)

| Método | Rota | Função |
|--------|------|--------|
| POST | `/projects` | Criar projeto (utilizador demo). |
| GET | `/projects/:id` | Metadados + `subtitleFileId` recente. |
| POST | `/projects/:id/media` | Upload multipart; grava `storageKey`, `durationMs`, SubtitleFile. |
| POST | `/projects/:id/transcriptions` | Cria job e processa em background. |
| GET | `/projects/:id/cues` | Cues ordenadas. |
| GET | `/projects/:id/export/srt` | Download `.srt`. |
| GET | `/jobs/:jobId/status` | Estado do job. |
| POST | `/jobs/:jobId/retry` | Reprocessar job FAILED. |
| POST | `/jobs/:jobId/reprocess-normalization` | Só normalização a partir de `rawResponse`. |
| PATCH | `/cues/:cueId` | Editar cue. |
| POST | `/cues/batch` | Alias do bulk-update do editor. |
| — | `/subtitle-files/...`, `/subtitle-cues/...` | Leitura/áudio/export/editor (já existentes). |

---

## 5. Estrutura de pastas relevante (transcrição)

```txt
web/
  app/
    api/
      projects/...
      jobs/...
      cues/...
    gerar/page.tsx                # gerador SRT em lote (ZIP)
    subtitle-file-edit/           # editor (bootstrap remoto com ?subtitleFileId=)
  src/
    server/
      transcription/             # módulos da pipeline
      demo-user.ts
      subtitle-file-queries.ts
  middleware.ts                  # opcional: API_SECRET + rate limit
  prisma/
  next.config.ts                 # body size ∝ MAX_FILE_SIZE_MB
```

---

## 6. Fluxo ponta a ponta (resumo)

1. `POST /api/projects` → `POST /api/projects/:id/media` (ficheiro + duração).
2. `POST /api/projects/:id/transcriptions` → job PENDING → background → adapter → `rawResponse` + normalização → cues em transação → DONE.
3. Polling `GET /api/jobs/:jobId/status` até DONE (integrações/API).
4. Abrir o editor manualmente: `/subtitle-file-edit?subtitleFileId=...` → `GET /api/subtitle-files/:id` carrega cues e áudio.

**Fluxo UI principal:** `/gerar` — batch (`POST /api/batch-jobs`, …), polling do batch, download ZIP (sem redirect ao editor).

---

## 7. Roadmap — o que ainda falta (por fase)

### Fase 2 (robustez) — alinhado à especificação

- Worker assíncrono: **BullMQ / Inngest / Trigger.dev** (fila dedicada).
- **SSE** ou WebSocket para progresso (hoje só polling).
- **Chunking** com overlap para ficheiros grandes (limite da API Whisper).
- Retry **por engine** (config por provider).
- **Rate limit global** (Redis/Upstash) em vez de só memória por instância.
- **ProjectRepository** usado de forma consistente nas rotas.

### Fase 3–4 — qualidade e expansão

- Como no documento original (CPS, segmentos problemáticos, VTT/ASS, multi-tenant, billing, vídeo + extração de áudio, etc.).

### Documentação / ops

- Atualizar **ARCHITECTURE.md** com secção curta “Pipeline de transcrição” + link para este ficheiro (ou fundir gradualmente).
- CI: `npm run test` + `db:deploy` em pipeline se aplicável.

---

## 8. Variáveis de ambiente (referência rápida)

Ver **`web/.env.example`**: `DATABASE_URL`, `OPENAI_API_KEY`, `MAX_FILE_SIZE_MB`, `MAX_TRANSCRIPTION_ATTEMPTS`, `MEDIA_STORAGE_DIR`, `API_SECRET`, `API_RATE_LIMIT_PER_MINUTE`, notas Vercel e proxy.

---

## 9. Conclusão

A **pipeline em camadas** (storage → job → adapter → normalização → persistência) está **implementada no MVP**, com **editor desacoplado** do formato OpenAI, **`rawResponse` persistido**, **re-normalização** sem nova chamada à API, **UI `/gerar`** (gerador em lote), **middleware opcional** de segurança, e **limites de body** alinhados.

**Não implementado** de propósito nesta fase: **fila distribuída**, **auth de utilizador final (NextAuth)**, **S3/R2** como storage primário, **chunking**, **ProjectRepository em todas as rotas**, **logging estruturado** avançado, e **atualização profunda do ARCHITECTURE.md** além do link recomendado.

---

*Última revisão: alinhada ao código em `SubtitleBot/web/` (Next.js App Router + Prisma).*
