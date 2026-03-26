-- Add secure per-user OpenAI/Whisper API key storage (encrypted + mask only).
ALTER TABLE "User"
ADD COLUMN "openAiWhisperKeyEncrypted" TEXT,
ADD COLUMN "openAiWhisperKeyMask" TEXT;

