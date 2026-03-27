export type SendCommunicationLogWhatsappParams = {
  apiUrl: string;
  apiKey: string;
  instanceName: string;
  toWhatsapp: string;
  textBody: string;
};

function sanitizeApiUrl(raw: string): string {
  return raw.trim().replace(/\/+$/, "");
}

function toDigitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

function pickProviderMessageId(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const obj = body as Record<string, unknown>;
  const direct = obj.id;
  if (typeof direct === "string" && direct.trim()) return direct.trim().slice(0, 255);
  const key = obj.key;
  if (key && typeof key === "object") {
    const keyObj = key as Record<string, unknown>;
    if (typeof keyObj.id === "string" && keyObj.id.trim()) {
      return keyObj.id.trim().slice(0, 255);
    }
  }
  const data = obj.data;
  if (data && typeof data === "object") {
    const dataObj = data as Record<string, unknown>;
    if (typeof dataObj.id === "string" && dataObj.id.trim()) {
      return dataObj.id.trim().slice(0, 255);
    }
    const nestedKey = dataObj.key;
    if (nestedKey && typeof nestedKey === "object") {
      const nestedKeyObj = nestedKey as Record<string, unknown>;
      if (typeof nestedKeyObj.id === "string" && nestedKeyObj.id.trim()) {
        return nestedKeyObj.id.trim().slice(0, 255);
      }
    }
  }
  return null;
}

/**
 * Envia mensagem de texto de CommunicationLog via Evolution API.
 * Endpoint alvo: POST /message/sendText/:instanceName
 */
export async function sendCommunicationLogViaEvolution(
  params: SendCommunicationLogWhatsappParams,
): Promise<{ ok: true; providerMessageId: string | null } | { ok: false; message: string }> {
  const apiUrl = sanitizeApiUrl(params.apiUrl);
  const number = toDigitsOnly(params.toWhatsapp);
  const body = params.textBody.trim();

  if (!number || body.length === 0) {
    return { ok: false, message: "Número WhatsApp ou corpo inválido para envio." };
  }

  const endpoint = `${apiUrl}/message/sendText/${encodeURIComponent(params.instanceName)}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      apikey: params.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      number,
      text: body,
    }),
  });

  let jsonBody: unknown = null;
  try {
    jsonBody = await res.json();
  } catch {
    jsonBody = null;
  }

  if (res.ok) {
    return { ok: true, providerMessageId: pickProviderMessageId(jsonBody) };
  }

  let message = `Evolution HTTP ${res.status}`;
  if (jsonBody && typeof jsonBody === "object") {
    const obj = jsonBody as Record<string, unknown>;
    if (typeof obj.message === "string" && obj.message.trim()) {
      message = obj.message.trim();
    } else if (typeof obj.error === "string" && obj.error.trim()) {
      message = obj.error.trim();
    }
  }
  return { ok: false, message: message.slice(0, 500) };
}
