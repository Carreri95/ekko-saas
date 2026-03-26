/**
 * Resend (https://resend.com) — envio via HTTPS; sem SDK extra.
 * `EMAIL_FROM` deve ser um remetente autorizado na conta (domínio verificado ou sandbox Resend).
 */
export function getInviteEmailConfig(): {
  resendApiKey: string | null;
  emailFrom: string;
} {
  const resendApiKey = process.env.RESEND_API_KEY?.trim() || null;
  const emailFrom =
    process.env.EMAIL_FROM?.trim() || "SubtitleBot <onboarding@resend.dev>";
  return { resendApiKey, emailFrom };
}
