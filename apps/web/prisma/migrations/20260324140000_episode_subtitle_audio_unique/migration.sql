-- Relações 1:1 Episode ↔ SubtitleFile (Prisma 7): FKs únicos + inversas nomeadas em SubtitleFile.
-- Remove índice não único criado antes; substitui por UNIQUE (inclui índice implícito).

DROP INDEX IF EXISTS "Episode_audioFileId_idx";

CREATE UNIQUE INDEX IF NOT EXISTS "Episode_subtitleFileId_key" ON "Episode"("subtitleFileId");

CREATE UNIQUE INDEX IF NOT EXISTS "Episode_audioFileId_key" ON "Episode"("audioFileId");
