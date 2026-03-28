-- PR 29E: preferências de canal (paridade com CastMember)
ALTER TABLE "Collaborator" ADD COLUMN "prefersEmail" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Collaborator" ADD COLUMN "prefersWhatsapp" BOOLEAN NOT NULL DEFAULT false;
