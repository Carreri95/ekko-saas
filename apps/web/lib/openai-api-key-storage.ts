const STORAGE_KEY = "subtitlebot.openaiApiKey";

/** Chave só em memória de sessão (sessionStorage), não no servidor. */
export function getStoredOpenAiApiKey(): string {
  if (typeof window === "undefined") return "";
  try {
    return sessionStorage.getItem(STORAGE_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function setStoredOpenAiApiKey(key: string): void {
  if (typeof window === "undefined") return;
  try {
    const t = key.trim();
    if (t) sessionStorage.setItem(STORAGE_KEY, t);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
