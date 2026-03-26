import type { AuthMeResponse } from "@subtitlebot/shared";

export type AuthMeResult =
  | { ok: true; user: AuthMeResponse }
  | { ok: false; status: number; error?: string };

/**
 * Consulta a sessão actual via BFF (`/api/auth/me`). Usar no cliente com `credentials: 'include'`.
 */
export async function fetchAuthMe(): Promise<AuthMeResult> {
  const res = await fetch("/api/auth/me", {
    credentials: "include",
    cache: "no-store",
  });

  if (res.ok) {
    const data = (await res.json()) as { user: AuthMeResponse };
    return { ok: true, user: data.user };
  }

  let error: string | undefined;
  try {
    const data = (await res.json()) as { error?: string };
    error = data.error;
  } catch {
    /* corpo não JSON */
  }

  return { ok: false, status: res.status, error };
}
