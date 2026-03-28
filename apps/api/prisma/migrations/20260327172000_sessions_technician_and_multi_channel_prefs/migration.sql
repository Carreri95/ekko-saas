-- PR 29D: tecnico de gravacao em sessao + canais simultaneos no dublador
ALTER TABLE "CastMember"
ADD COLUMN "prefersEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "prefersWhatsapp" BOOLEAN NOT NULL DEFAULT false;

UPDATE "CastMember"
SET
  "prefersEmail" = CASE
    WHEN "preferredCommunicationChannel" = 'WHATSAPP' THEN false
    ELSE true
  END,
  "prefersWhatsapp" = CASE
    WHEN "preferredCommunicationChannel" = 'WHATSAPP' THEN true
    ELSE false
  END;

ALTER TABLE "CastMember"
DROP COLUMN "preferredCommunicationChannel";

DROP TYPE "PreferredCommunicationChannel";

ALTER TABLE "RecordingSession"
ADD COLUMN "recordingTechnicianId" TEXT;

ALTER TABLE "RecordingSession"
ADD CONSTRAINT "RecordingSession_recordingTechnicianId_fkey"
FOREIGN KEY ("recordingTechnicianId") REFERENCES "Collaborator"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "RecordingSession_recordingTechnicianId_idx"
ON "RecordingSession"("recordingTechnicianId");
