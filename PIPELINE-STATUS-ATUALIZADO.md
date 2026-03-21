# Pipeline de transcrição automática — status de implementação (MVP → escala)

Este documento espelha o **pipeline-status-atualizado** (matriz pedido × feito × falta) e o desenho do **Gerador de SRT em lote** frente ao **Editor de legendas**. Complementa o estado técnico detalhado em [PIPELINE-TRANSCRICAO.md](./PIPELINE-TRANSCRICAO.md) e a visão geral em [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Legenda de estado

| Símbolo | Significado |
|--------|-------------|
| **Feito** | Implementado e a funcionar no repositório atual. |
| **Parcial** | Existe mas com lacunas conhecidas; não bloqueia o MVP, mas precisa atenção antes de produção. |
| **Não feito** | Estava na especificação do MVP mas ainda não foi implementado. |
| **Fase 2+** | Intencionalmente deixado para fases futuras (roadmap), não é dúvida técnica acidental. |

---

## 0. Separação fundamental: gerador de SRT vs editor de legendas

Esta é a decisão de produto mais importante da arquitetura: **dois produtos** independentes que partilham a mesma pipeline técnica por baixo (storage, adapter, normalização, cues), mas com **UX, endpoints e fluxos separados**.

| Aspeto | Gerador de SRT (produção em lote) | Editor de legendas (revisão fina) |
|--------|-------------------------------------|-----------------------------------|
| Entrada | O utilizador envia **N** áudios de uma vez. | O utilizador abre **um** ficheiro específico. |
| Processamento | O sistema transcreve todos **sequencialmente** (paralelo na Fase 2). | O sistema carrega as cues da base para revisão. |
| Saída | Ao terminar, compacta todos os `.srt` num `.zip` e disponibiliza download. | O utilizador edita texto, timings, divide e une cues. |
| Utilização | O utilizador leva o ZIP e usa os ficheiros onde quiser. | O utilizador grava alterações na base e exporta o `.srt` final. |
| Editor | **Não** abre o editor automaticamente. | **Não** processa transcrição em lote — só consome cues já geradas. |
| Fluxo resumido | Upload em lote → jobs → ZIP → download | Abrir ficheiro → editar → gravar → exportar `.srt` |

**Regra de produto:** o **gerador nunca** redireciona para o editor automaticamente. Se o utilizador quiser rever um dos SRTs gerados, abre o editor por iniciativa própria e carrega o ficheiro.

**Partilha técnica:** ambos usam `MediaStorageService`, `TranscriptionAdapter`, `TranscriptNormalizer` e `CueRepository`. Nenhum domínio conhece os detalhes internos do outro.

### 0.1 Fluxo do gerador de SRT (em lote)

| # | Passo | Detalhe |
|---|--------|---------|
| 1 | Utilizador seleciona N ficheiros de áudio | Interface de upload múltiplo (drag & drop); sem limite de quantidade imposto no cliente. |
| 2 | Upload individual de cada ficheiro | `POST /api/batch-jobs/:batchId/files` — cada áudio gera um `TranscriptionJob` no batch. |
| 3 | Criação do batch | Agrupa N jobs com estado próprio: PENDING → RUNNING → DONE. |
| 4 | Processamento dos jobs | **MVP:** sequencial (um de cada vez). **Fase 2:** paralelo com fila. Cada job segue: adapter → normalizer → cues. |
| 5 | Polling de progresso | `GET /api/batch-jobs/:batchId/status` → `{ total, done, failed, running }`; UI com barra de progresso. |
| 6 | Geração do ZIP ao concluir | Backend percorre jobs em DONE → gera `.srt` em memória com `formatSrt()` → compacta → grava. |
| 7 | Download do ZIP | `GET /api/batch-jobs/:batchId/download` — stream do `.zip` com `Content-Disposition: attachment`. |
| 8 | Jobs com falha: relatório | UI lista ficheiros que falharam; reprocessamento individual possível. Falhas **não** entram no ZIP. |

### 0.2 Novos endpoints do gerador (ainda não implementados)

| Método | Rota | Responsabilidade |
|--------|------|------------------|
| POST | `/api/batch-jobs` | Cria um batch vazio; devolve `batchId`. |
| POST | `/api/batch-jobs/:batchId/files` | Adiciona um ficheiro ao batch (multipart); devolve `jobId` individual. |
| POST | `/api/batch-jobs/:batchId/start` | Arranca o processamento de todos os ficheiros. |
| GET | `/api/batch-jobs/:batchId/status` | Progresso: `{ total, done, failed, running, jobs[] }`. |
| GET | `/api/batch-jobs/:batchId/download` | Download do `.zip`; só quando o batch está concluído (`DONE`). |
| POST | `/api/batch-jobs/:batchId/jobs/:jobId/retry` | Reprocessa um job falhado dentro do contexto do batch. |

### 0.3 Modelo de dados do batch (a criar)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK do batch. |
| `status` | enum | `PENDING` \| `RUNNING` \| `DONE` \| `FAILED`. |
| `engine` | texto | `"openai-whisper"` \| `"mock"` — aplicado a todos os jobs do batch. |
| `language` | texto, opcional | Idioma sugerido para todos (pode ser sobrescrito por job). |
| `zip_storage_key` | texto, opcional | Referência ao `.zip` gerado; `null` até o batch completar. |
| `total_files` | int | Quantidade de ficheiros no batch. |
| `created_at` | timestamp | Criação. |
| `completed_at` | timestamp, opcional | Quando todos os jobs terminaram (DONE ou FAILED). |

**`TranscriptionJob`:** ganha um campo **`batch_id` opcional**. Jobs com `batch_id` pertencem ao gerador; jobs sem `batch_id` vêm de `POST /api/projects/.../transcriptions` (API) ou legado — **não há UI dedicada** para esse fluxo individual.

**Nota:** `DONE` do batch **não** significa que todos os jobs tiveram sucesso — significa que **não há mais jobs em execução**. A UI deve mostrar: X concluídos, Y com falha.

### 0.4 Estado do gerador de SRT na implementação atual

| Item especificado | Estado | Notas |
|-------------------|--------|-------|
| Modelo `BatchJob` + migration | **Não feito** | Novo — conforme secção 0.3. |
| `BatchJobService` (orquestração do lote) | **Não feito** | Novo módulo; MVP: loop sequencial com atualização de progresso. |
| Upload múltiplo em lote | **Não feito** | Novo endpoint + UI drag & drop múltiplo. |
| Polling de progresso do batch | **Não feito** | `GET /api/batch-jobs/:batchId/status`. |
| Geração do ZIP com todos os `.srt` ao concluir | **Não feito** | `archiver` ou `adm-zip` + `formatSrt()` existente. |
| Download do ZIP | **Não feito** | Stream com `Content-Disposition`. |
| Retry de job individual no batch | **Não feito** | Endpoint novo no contexto do batch. |
| UI do gerador (lote, progresso, download) | **Não feito** | Página separada do editor. |
| Processamento paralelo dos jobs do batch | **Fase 2+** | MVP sequencial; paralelo com fila dedicada mais tarde. |

---

## 1. Backend — módulos

### 1.1 MediaStorageService

| Item especificado | Estado | Notas |
|-------------------|--------|-------|
| Validação de MIME (mp3, wav, m4a, webm) | **Feito** | Extensão por MIME em `media-storage.service.ts`. |
| Tamanho máximo (`MAX_FILE_SIZE_MB`) | **Feito** | Variável de ambiente; default 500 MB. |
| `storageKey` opaco (UUID + extensão) | **Feito** | Path de disco não exposto ao frontend. |
| `durationMs` no upload | **Feito** | `music-metadata` no buffer (sem ffmpeg); `null` se formato não suportado. |
| S3 / R2 (cloud) | **Fase 2+** | MVP em disco local (`public/uploads/media` ou `MEDIA_STORAGE_DIR`). |

### 1.2 TranscriptionJobService

| Item especificado | Estado | Notas |
|-------------------|--------|-------|
| Criar job `PENDING` | **Feito** | `transcription-job.service.ts`. |
| Transições PENDING → RUNNING → DONE/FAILED | **Feito** | Com timestamps. |
| Retry com backoff exponencial | **Feito** | `MAX_TRANSCRIPTION_ATTEMPTS` (default 3). |
| Logging estruturado em cada transição | **Parcial** | `console.log` com JSON; falta logger dedicado (Pino, Winston, etc.). |
| Worker / fila assíncrona | **Fase 2+** | Hoje `void` na mesma instância HTTP; adequado ao MVP. |

### 1.3 TranscriptionAdapter (interface + implementações)

| Item especificado | Estado | Notas |
|-------------------|--------|-------|
| Interface `TranscriptionAdapter` | **Feito** | `transcription-adapter.ts`. |
| `OpenAIWhisperAdapter` (`verbose_json`, timestamps) | **Feito** | `timestamp_granularities[]` = segment. |
| `MockAdapter` | **Feito** | `mock-transcription.adapter.ts`; `engine: "MOCK"` no POST de transcrições. |
| `rawResponse` obrigatório no adapter | **Feito** | Contrato `{ transcript, rawResponse }` para persistir bruto. |
| AssemblyAI / Deepgram / outros | **Fase 2+** | Interface preparada para novas implementações. |

### 1.4 TranscriptNormalizer

| Item especificado | Estado | Notas |
|-------------------|--------|-------|
| `normalize()` com cueIndex, startMs, endMs, text | **Feito** | `transcript-normalizer.ts`. |
| `cleanText()` (trim, espaços, artefactos Whisper) | **Feito** | Remove `[Music]`, `(inaudível)`, etc. |
| Filtrar segmentos vazios ou só pontuação | **Feito** | Sem regex frágil. |
| Testes unitários | **Feito** | Vitest em `transcript-normalizer.test.ts`. |
| Chunking para ficheiros > 25 MB (overlap) | **Fase 2+** | Limite da API Whisper; não no MVP. |

### 1.5 CueRepository

| Item especificado | Estado | Notas |
|-------------------|--------|-------|
| `saveBatchForTranscription()` em transação | **Feito** | Substitui cues do `subtitleFile` no fluxo de transcrição. |
| Cues ligadas ao job (`transcriptionJobId`) | **Feito** | Campo opcional; cues manuais com `job_id` null. |
| Índice `(subtitleFileId, startMs)` | **Feito** | Na migration Prisma. |
| `deleteByJob()` isolado para reprocessamento | **Parcial** | `saveBatch` já substitui tudo; método isolado não exposto. |

### 1.6 ProjectRepository

| Item especificado | Estado | Notas |
|-------------------|--------|-------|
| Ficheiro `project-repository.ts` existe | **Feito** | Encapsula lógica de projeto. |
| Uso consistente em todas as rotas | **Parcial** | Várias rotas usam Prisma direto; refactor de consistência em Fase 2. |

---

## 2. Modelo de dados

| Item especificado | Estado | Notas |
|-------------------|--------|-------|
| Tabela `transcription_jobs` com campos necessários | **Feito** | Inclui `rawResponse` (JSON), `attemptCount`, `engine`, `status`, timestamps. |
| `raw_response` persistido | **Feito** | Permite reprocessar só normalização sem nova chamada à API. |
| Cues com `project_id` “separado” | **Parcial** | Modelo real: `SubtitleCue` + `SubtitleFile`; `transcriptionJobId` opcional. Evita migração pesada no editor. |
| Índice composto por ficheiro + índice de cue | **Feito** | `subtitleFileId` + `cueIndex` no Prisma. |
| `Project.storageKey`, `mediaKind`, `durationMs` | **Feito** | Migration da pipeline. |
| Migration versionada | **Feito** | Ex.: `20260321120000_add_transcription_pipeline/`. |
| Tabela `batch_jobs` + `batch_id` em `transcription_jobs` | **Não feito** | Necessário para o gerador em lote (secção 0.3). |

---

## 3. Endpoints

### 3.1 Endpoints existentes (pipeline individual + editor)

| Método | Rota | Estado | Notas |
|--------|------|--------|-------|
| POST | `/api/projects` | **Feito** | Projeto com utilizador demo do seed. |
| GET | `/api/projects/:id` | **Feito** | Metadados + `subtitleFileId` mais recente. |
| POST | `/api/projects/:id/media` | **Feito** | Multipart; `storageKey`, `durationMs`, `SubtitleFile`. |
| POST | `/api/projects/:id/transcriptions` | **Feito** | Job `PENDING` e execução em background. |
| GET | `/api/jobs/:jobId/status` | **Feito** | Estado do job + metadados. |
| POST | `/api/jobs/:jobId/retry` | **Feito** | Reprocessar job `FAILED`. |
| POST | `/api/jobs/:jobId/reprocess-normalization` | **Feito** | A partir de `rawResponse` guardado. |
| GET | `/api/projects/:id/cues` | **Feito** | Cues ordenadas por `cueIndex`. |
| PATCH | `/api/cues/:cueId` | **Feito** | Texto, `startMs`, `endMs`. |
| POST | `/api/cues/batch` | **Feito** | Upsert em lote. |
| GET | `/api/projects/:id/export/srt` | **Feito** | Download `.srt`. |

### 3.2 Endpoints do gerador (a implementar — ver 0.2)

| Método | Rota | Estado |
|--------|------|--------|
| POST | `/api/batch-jobs` | **Não feito** |
| POST | `/api/batch-jobs/:batchId/files` | **Não feito** |
| POST | `/api/batch-jobs/:batchId/start` | **Não feito** |
| GET | `/api/batch-jobs/:batchId/status` | **Não feito** |
| GET | `/api/batch-jobs/:batchId/download` | **Não feito** |
| POST | `/api/batch-jobs/:batchId/jobs/:jobId/retry` | **Não feito** |

---

## 4. Frontend

| Item especificado | Estado | Notas |
|-------------------|--------|-------|
| Página `/transcribe` (fluxo individual → editor) | **Removido** | Substituído pelo foco em `/gerar`; APIs individuais mantidas. |
| Página `/gerar` (lote + progresso + ZIP) | **Feito** | `app/gerar/page.tsx` + `components/batch/*`; sem redirect ao editor. |
| Motor mock vs OpenAI e idioma (gerador) | **Feito** | Modal no gerador. |
| Polling do batch (ex.: 2 s) | **Feito** | `GET /api/batch-jobs/:batchId/status`. |
| Estado FAILED + retry (gerador) | **Feito** | Retry por job no batch. |
| Editor com `?subtitleFileId=` | **Feito** | `GET /api/subtitle-files/:id` — cues + áudio + nome. |
| `/` redireciona para `/gerar` | **Feito** | `app/page.tsx`. |
| Sidebar: gerador (navegação) | **Feito** | `sidebar-nav.tsx` — item “Gerador SRT”. |
| Barra de progresso / contadores (gerador) | **Feito** | `BatchStatusBar` + tabela. |
| Relatório de falhas no gerador | **Parcial** | Coluna de estado e mensagens de erro por job; relatório dedicado pode evoluir. |

---

## 5. Qualidade e ops

| Item especificado | Estado | Notas |
|-------------------|--------|-------|
| MockAdapter determinístico (testes) | **Feito** | `mock-transcription.adapter.test.ts`. |
| Testes do `TranscriptNormalizer` | **Feito** | Vitest. |
| Testes do parse de `rawResponse` | **Feito** | `raw-response-to-transcript.test.ts`. |
| `npm run test` | **Feito** | `vitest.config.ts` + `package.json`. |
| `web/.env.example` | **Feito** | Variáveis documentadas (BD, OpenAI, limites, segurança, notas Vercel/proxy). |
| `next.config.ts` alinhado a `MAX_FILE_SIZE_MB` | **Feito** | `proxyClientMaxBodySize` + `serverActions.bodySizeLimit`. |
| `docker-compose.yml` (Postgres 16) | **Feito** | Na raiz; `npm run db:up`. |
| `npm run db:migrate` / `db:deploy` / `db:seed` | **Feito** | Scripts na raiz e em `web/`. |
| `prisma.config.ts` com seed | **Feito** | `prisma db seed` → `tsx prisma/seed.ts`. |
| Logger dedicado (Pino, etc.) | **Parcial** | MVP com `console.log` JSON; Fase 2. |
| Testes de integração (rotas, BD) | **Não feito** | Apenas funções puras; integração exige BD de teste. |
| CI (GitHub Actions, etc.) | **Não feito** | Testes locais; sem automação em PR. |

---

## 6. Segurança

| Item especificado | Estado | Notas |
|-------------------|--------|-------|
| Middleware opcional `API_SECRET` (Bearer / `X-API-Key`) | **Feito** | `web/middleware.ts` se `API_SECRET` definido. |
| Rate limit por IP (`API_RATE_LIMIT_PER_MINUTE`) | **Feito** | Janela 60 s em memória; instância única. |
| Rate limit distribuído (Redis/Upstash) | **Fase 2+** | Multi-réplica / serverless. |
| Autenticação de utilizador (NextAuth, etc.) | **Fase 2+** | MVP: utilizador demo; `API_SECRET` para acesso externo. |
| `API_SECRET` não combina com `fetch` do browser | **Parcial** | Documentado em `.env.example`; proxy / Server Actions / sessão em produção. |

---

## 7. Gaps reais do MVP (não eram Fase 2)

Itens no checklist do MVP ainda em aberto; **não** bloqueiam o fluxo básico, mas são dúvida técnica real:

| Gap | O que fazer |
|-----|-------------|
| Logging nas transições de job | Substituir `console.log` por Pino (ou similar) com campos fixos: `jobId`, `status`, `engine`, `durationMs`, `error`. |
| `ProjectRepository` em todas as rotas | Refactor: rotas como `/api/projects/:id/media` deixam de usar Prisma direto onde fizer sentido. |
| Testes de integração das rotas | Cobrir endpoints principais com BD de teste (Postgres em Docker ou CI). |
| CI automatizado | GitHub Actions: `npm run test` + `prisma migrate deploy` em PR. |
| `.gitignore` para `public/uploads/media/` | Evitar commits de média de teste. |

---

## 8. Roadmap — Fase 2 e além

### Fase 2 — robustez

- Fila assíncrona (BullMQ / Inngest / Trigger.dev): jobs do batch em paralelo, fora do processo HTTP.
- SSE em `/jobs/:id/status/stream` e `/batch-jobs/:id/status/stream` (progresso sem polling agressivo).
- Chunking automático para ficheiros > 25 MB com overlap ~2 s.
- Rate limit distribuído (Redis/Upstash).
- Storage S3/R2.
- `ProjectRepository` consistente em todas as rotas.
- Logger dedicado com campos estruturados.
- Limpeza periódica de ZIPs e média antiga.

### Fase 3 — qualidade

- Alinhamento fino de timings (WhisperX / forced alignment).
- Deteção de segmentos problemáticos (CPS, sobreposição, duração mínima).
- Mesclagem automática de segmentos muito curtos.
- Revisão por IA (sugestões de texto via GPT-4).
- Suporte a vídeo: extração de áudio com ffmpeg antes do Whisper.

### Fase 4 — expansão

- Múltiplos motores (AssemblyAI, Deepgram, ElevenLabs Scribe) selecionáveis por batch.
- Job de tradução com mesma máquina de estados.
- Multi-tenant, auth real, billing por minuto.
- Export do ZIP em VTT, TTML, SBV, ASS.
- Histórico de batches por utilizador e re-download.
- Reprocessamento seletivo (só segmentos alterados).

---

## 9. Fluxo ponta a ponta — pipeline individual (API + editor)

A **UI `/transcribe` foi removida**; o pipeline HTTP abaixo continua válido para integrações ou testes manuais. O fluxo do **gerador em lote** está na secção 0.1 (`/gerar`).

| # | Passo | Implementação |
|---|--------|----------------|
| 1 | `POST /api/projects` | Cria projeto com utilizador demo. |
| 2 | `POST /api/projects/:id/media` | `MediaStorageService` valida, grava, devolve `storageKey` + `durationMs`; cria/atualiza `SubtitleFile`. |
| 3 | `POST /api/projects/:id/transcriptions` | Job `PENDING`; execução em background (`void`). |
| 4 | Background: RUNNING → adapter | `OpenAIWhisperAdapter` com `FormData`, `/v1/audio/transcriptions`, `verbose_json`. |
| 5 | Background: `rawResponse` persistido | JSON bruto em `TranscriptionJob.rawResponse` antes de normalizar. |
| 6 | Background: normalização → cues | `TranscriptNormalizer` → `NormalizedCue[]`; `CueRepository.saveBatchForTranscription` em transação. |
| 7 | Background: job → DONE | `completedAt`; `SubtitleFile.sourceType = IMPORTED_WHISPER`. |
| 8 | Cliente: polling do job | `GET /api/jobs/:jobId/status` — **sem página dedicada**; abrir o editor manualmente com `?subtitleFileId=` se necessário. |
| 9 | Editor: sessão remota | `GET /api/subtitle-files/:id` — cues + áudio + filename; editor pronto para edição. |

---

## Documentos relacionados

- **[PIPELINE-TRANSCRICAO.md](./PIPELINE-TRANSCRICAO.md)** — estado do MVP da transcrição, checklist técnico e roadmap da pipeline no código atual.
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — arquitetura geral do SubtitleBot e referências à stack.

---

*Documento de status: gerador de SRT + editor de legendas — alinhado ao pipeline-status-atualizado.*
