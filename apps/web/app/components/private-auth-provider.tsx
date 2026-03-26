"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import type { AuthMeResponse } from "@subtitlebot/shared";
import { fetchAuthMe } from "@/src/lib/auth-client";

type PrivateAuthValue = {
  user: AuthMeResponse;
  ready: true;
  /** Logout via BFF → API; depois redireciona para `/login` (reload limpa estado React). */
  signOut: () => Promise<void>;
  /** Rele `GET /api/auth/me` e actualiza o contexto (ex.: após guardar perfil). */
  refreshUser: () => Promise<void>;
};

const PrivateAuthContext = createContext<PrivateAuthValue | null>(null);

/** Disponível dentro de `app/(private)/layout`. */
export function usePrivateAuth(): PrivateAuthValue {
  const ctx = useContext(PrivateAuthContext);
  if (!ctx) {
    throw new Error("usePrivateAuth só pode ser usado dentro da área privada.");
  }
  return ctx;
}

/** Para componentes partilhados (ex.: PageShell) que podem existir fora do grupo privado. */
export function useOptionalPrivateAuth(): PrivateAuthValue | null {
  return useContext(PrivateAuthContext);
}

export function PrivateAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<
    | { phase: "loading" }
    | { phase: "ok"; user: AuthMeResponse }
    | { phase: "redirect" }
  >({ phase: "loading" });

  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setState({ phase: "redirect" });
      window.location.assign("/login");
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const r = await fetchAuthMe();
    if (!r.ok) {
      setState({ phase: "redirect" });
      router.replace("/login");
      return;
    }
    setState({ phase: "ok", user: r.user });
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchAuthMe();
      if (cancelled) return;
      if (!r.ok) {
        setState({ phase: "redirect" });
        router.replace("/login");
        return;
      }
      setState({ phase: "ok", user: r.user });
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  /** Revalida sessão ao regressar ao separador (cookie expirado, logout noutro tab, etc.). */
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      void fetchAuthMe().then((r) => {
        if (!r.ok) {
          router.replace("/login");
          return;
        }
        setState((prev) =>
          prev.phase === "ok" ? { phase: "ok", user: r.user } : prev,
        );
      });
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [router]);

  const value = useMemo(() => {
    if (state.phase !== "ok") return null;
    return {
      user: state.user,
      ready: true as const,
      signOut,
      refreshUser,
    };
  }, [state, signOut, refreshUser]);

  if (state.phase === "loading" || state.phase === "redirect") {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
        <p className="text-sm text-[var(--text-muted)]">A carregar…</p>
      </div>
    );
  }

  if (!value) {
    return null;
  }

  return (
    <PrivateAuthContext.Provider value={value}>{children}</PrivateAuthContext.Provider>
  );
}
