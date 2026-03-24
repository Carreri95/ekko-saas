# apps/worker — processamento de `TranscriptionJob` (PR 6.1)

Processo Node de longa duração que faz **polling** na BD, **claim** atómico `PENDING` → `RUNNING`, executa o pipeline Whisper/Mock (mesma lógica que existia no Next) e grava cues / estado.

## Pré-requisitos

1. Postgres acessível com o mesmo `DATABASE_URL` que `apps/web`.
2. Cliente Prisma gerado em `apps/api`: `npm run db:generate --prefix apps/api`
3. Ficheiros de áudio no disco no mesmo root que o Next (`../web/public/uploads/media` por defeito) ou `MEDIA_STORAGE_DIR`.
4. `OPENAI_API_KEY` (motor `OPENAI_WHISPER`) ou jobs com motor `MOCK` para testes.

## Desenvolvimento

```bash
cd apps/worker
cp .env.example .env
# editar DATABASE_URL, OPENAI_API_KEY, etc.
npm install
npm run dev
```

Na raiz do monorepo:

```bash
npm run dev:worker
```

## Variáveis

Ver `.env.example`.

## Build

```bash
npm run build
npm start
```

O output fica em `dist/` (ESM).
