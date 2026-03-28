const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateActiveCommunicationChannels(input: {
  prefersEmail: boolean;
  prefersWhatsapp: boolean;
  email: string | null | undefined;
  whatsapp: string | null | undefined;
}): { ok: true } | { error: string } {
  if (!input.prefersEmail && !input.prefersWhatsapp) {
    return {
      error: "Selecione ao menos um canal de comunicação (e-mail e/ou WhatsApp).",
    };
  }

  const emailTrim = (input.email ?? "").trim();
  const waDigits = (input.whatsapp ?? "").replace(/\D/g, "");

  if (input.prefersEmail) {
    if (!emailTrim || !EMAIL_RE.test(emailTrim)) {
      return {
        error: "E-mail é obrigatório e deve ser válido quando o canal e-mail está ativo.",
      };
    }
  }

  if (input.prefersWhatsapp) {
    if (waDigits.length < 8) {
      return {
        error: "WhatsApp é obrigatório quando o canal WhatsApp está ativo.",
      };
    }
  }

  return { ok: true };
}
