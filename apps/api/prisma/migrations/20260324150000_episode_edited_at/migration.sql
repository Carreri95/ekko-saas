-- Alinhar com apps/api (Episode.editedAt); evita 500 em GET /api/dubbing-projects/:id/episodes.
ALTER TABLE "Episode" ADD COLUMN "editedAt" TIMESTAMP(3);
