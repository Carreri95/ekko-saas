function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type SendInviteEmailParams = {
  apiKey: string;
  from: string;
  toEmail: string;
  inviteUrl: string;
  expiresAt: Date;
};

/**
 * Envia convite via API Resend (POST /emails).
 * @see https://resend.com/docs/api-reference/emails/send-email
 */
export async function sendInviteEmailViaResend(
  params: SendInviteEmailParams,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const expiresStr = params.expiresAt.toLocaleString("pt-PT", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const subject = "Convite — SubtitleBot";
  const text = [
    "Olá,",
    "",
    "Foi convidado a criar uma conta no SubtitleBot.",
    "",
    `Aceitar convite: ${params.inviteUrl}`,
    "",
    `Este convite expira em: ${expiresStr}`,
    "",
    "Se não esperava este email, pode ignorá-lo.",
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
  <p>Olá,</p>
  <p>Foi convidado a criar uma conta no <strong>SubtitleBot</strong>.</p>
  <p><a href="${escapeHtml(params.inviteUrl)}">Aceitar convite</a></p>
  <p style="color: #555; font-size: 14px;">Este convite expira em: ${escapeHtml(expiresStr)}</p>
  <p style="color: #888; font-size: 13px;">Se não esperava este email, pode ignorá-lo.</p>
</body>
</html>`.trim();

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.toEmail],
      subject,
      text,
      html,
    }),
  });

  if (res.ok) {
    return { ok: true };
  }

  let message = `Resend HTTP ${res.status}`;
  try {
    const body = (await res.json()) as { message?: string };
    if (typeof body.message === "string") {
      message = body.message;
    }
  } catch {
    /* ignore */
  }
  return { ok: false, message };
}
