const DEFAULT_API_PORT = 4000;
const DEFAULT_SESSION_MAX_AGE_SEC = 7 * 24 * 60 * 60;
const DEFAULT_INVITE_TTL_SEC = 7 * 24 * 60 * 60;
const DEFAULT_PUBLIC_WEB_ORIGIN = "http://localhost:3000";
const DEFAULT_SESSION_COOKIE_NAME = "sb_session";

function parseApiPort(raw: string | undefined): number {
  if (!raw) return DEFAULT_API_PORT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_API_PORT;
  return parsed;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export const env = {
  apiPort: parseApiPort(process.env.API_PORT),
  sessionCookieName: process.env.SESSION_COOKIE_NAME?.trim() || DEFAULT_SESSION_COOKIE_NAME,
  sessionMaxAgeSec: parsePositiveInt(
    process.env.SESSION_MAX_AGE_SEC,
    DEFAULT_SESSION_MAX_AGE_SEC,
  ),
  /** Em HTTPS em produção; em dev local HTTP usar `false` (omitir `COOKIE_SECURE` ou `false`). */
  cookieSecure:
    process.env.COOKIE_SECURE === "true" ||
    process.env.NODE_ENV === "production",
  /** Base URL da app web (links de convite `?token=`). */
  publicWebOrigin: process.env.PUBLIC_WEB_ORIGIN?.trim() || DEFAULT_PUBLIC_WEB_ORIGIN,
  /** Validade do convite em segundos (omissão: 7 dias). */
  inviteTtlSec: parsePositiveInt(process.env.INVITE_TTL_SEC, DEFAULT_INVITE_TTL_SEC),
  /**
   * Segredo para cifrar/decifrar chave OpenAI por utilizador.
   * Deve ser idêntico no apps/api e apps/worker.
   */
  openAiKeyEncryptionSecret: process.env.OPENAI_KEY_ENCRYPTION_SECRET?.trim() || "",
  /** Resend — envio síncrono de CommunicationLog (e-mail). Omisso: desativado até configurar. */
  resendApiKey: process.env.RESEND_API_KEY?.trim() || "",
  emailFrom:
    process.env.EMAIL_FROM?.trim() || "SubtitleBot <onboarding@resend.dev>",
  /** Evolution API — envio real de CommunicationLog por WhatsApp (outbound). */
  evolutionApiUrl: process.env.EVOLUTION_API_URL?.trim() || "",
  evolutionApiKey: process.env.EVOLUTION_API_KEY?.trim() || "",
  evolutionInstanceName: process.env.EVOLUTION_INSTANCE_NAME?.trim() || "",
};
