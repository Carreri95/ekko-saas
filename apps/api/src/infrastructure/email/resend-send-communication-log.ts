function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type SendCommunicationLogEmailParams = {
  apiKey: string;
  from: string;
  toEmail: string;
  subject: string;
  textBody: string;
};

/**
 * Envia e-mail de um CommunicationLog via Resend (POST /emails).
 * @see https://resend.com/docs/api-reference/emails/send-email
 */
export async function sendCommunicationLogViaResend(
  params: SendCommunicationLogEmailParams,
): Promise<{ ok: true; providerMessageId: string | null } | { ok: false; message: string }> {
  const html = `<pre style="font-family: system-ui, sans-serif; white-space: pre-wrap;">${escapeHtml(
    params.textBody,
  )}</pre>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.toEmail],
      subject: params.subject,
      text: params.textBody,
      html,
    }),
  });

  if (res.ok) {
    let providerMessageId: string | null = null;
    try {
      const body = (await res.json()) as { id?: unknown };
      if (typeof body.id === "string" && body.id.trim().length > 0) {
        providerMessageId = body.id.trim().slice(0, 255);
      }
    } catch {
      // Alguns providers podem devolver sucesso sem body JSON.
    }
    return { ok: true, providerMessageId };
  }

  let message = `Resend HTTP ${res.status}`;
  try {
    const body = (await res.json()) as { message?: /* string */ unknown };
    if (typeof body.message === "string") {
      message = body.message;
    }
  } catch {
    /* ignore */
  }
  return { ok: false, message: message.slice(0, 500) };
}
