"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchAuthMe } from "@/src/lib/auth-client";

const POST_ACCEPT_REDIRECT = "/projetos";

type ResolveStatus = "pending" | "expired" | "revoked" | "accepted";

type ResolveOk = {
  status: ResolveStatus;
  email: string;
  expiresAt: string;
};

function errorMessageFromBody(data: unknown): string {
  if (data && typeof data === "object" && "error" in data) {
    const e = (data as { error?: unknown }).error;
    if (typeof e === "string" && e.trim()) return e;
  }
  return "Pedido falhou";
}

export function InviteAcceptContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [resolve, setResolve] = useState<ResolveOk | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setPhase("error");
      setResolveError("Este link está incompleto. Use o link completo enviado no convite.");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/invites/resolve?token=${encodeURIComponent(token)}`,
          { credentials: "include", cache: "no-store" },
        );
        const data = (await res.json().catch(() => ({}))) as unknown;
        if (cancelled) return;

        if (res.status === 404) {
          setPhase("error");
          setResolveError(
            typeof (data as { error?: string }).error === "string"
              ? (data as { error: string }).error
              : "Convite inválido ou já não está disponível.",
          );
          return;
        }

        if (!res.ok) {
          setPhase("error");
          setResolveError(errorMessageFromBody(data));
          return;
        }

        const body = data as Partial<ResolveOk>;
        if (
          !body.status ||
          !body.email ||
          typeof body.expiresAt !== "string"
        ) {
          setPhase("error");
          setResolveError("Resposta inválida do servidor.");
          return;
        }

        setResolve({
          status: body.status as ResolveStatus,
          email: body.email,
          expiresAt: body.expiresAt,
        });
        setPhase("ready");
      } catch {
        if (!cancelled) {
          setPhase("error");
          setResolveError("Não foi possível validar o convite. Tente mais tarde.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !resolve || resolve.status !== "pending") return;

    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          name: name.trim(),
          password,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as unknown;

      if (!res.ok) {
        setSubmitError(errorMessageFromBody(data));
        return;
      }

      const me = await fetchAuthMe();
      if (me.ok) {
        router.replace(POST_ACCEPT_REDIRECT);
        router.refresh();
        return;
      }

      router.replace("/login?invite=complete");
    } catch {
      setSubmitError("Não foi possível concluir o registo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === "loading") {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center p-6">
        <p className="text-sm text-[var(--text-muted)]">A validar convite…</p>
      </div>
    );
  }

  if (phase === "error" || !resolve) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-auto p-6">
        <div className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-lg">
          <h1 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">Convite</h1>
          <p className="text-sm text-red-200/90" role="alert">
            {resolveError ?? "Não foi possível carregar o convite."}
          </p>
        </div>
      </div>
    );
  }

  if (resolve.status !== "pending") {
    const copy: Record<Exclude<ResolveStatus, "pending">, string> = {
      expired: "Este convite expirou. Peça um novo convite ao administrador.",
      revoked: "Este convite foi revogado. Contacte o administrador se precisar de acesso.",
      accepted: "Este convite já foi utilizado. Entre com email e senha na página de login.",
    };
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-auto p-6">
        <div className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-lg">
          <h1 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">Convite</h1>
          <p className="mb-4 text-sm text-[var(--text-muted)]">{copy[resolve.status]}</p>
          <p className="text-xs text-[var(--text-muted)]">
            Email do convite: <span className="text-[var(--text-primary)]">{resolve.email}</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-auto p-6">
      <div className="w-full max-w-sm rounded-lg border border-[var(--border)] bg-[var(--bg-elevated)] p-6 shadow-lg">
        <h1 className="mb-1 text-lg font-semibold text-[var(--text-primary)]">Aceitar convite</h1>
        <p className="mb-6 text-sm text-[var(--text-muted)]">
          Crie a sua conta para <span className="text-[var(--text-primary)]">{resolve.email}</span>
        </p>

        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="invite-name" className="text-sm font-medium text-[var(--text-primary)]">
              Nome
            </label>
            <input
              id="invite-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mvp-input w-full rounded-md px-3 py-2 text-sm"
              disabled={submitting}
              maxLength={200}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="invite-password" className="text-sm font-medium text-[var(--text-primary)]">
              Senha
            </label>
            <input
              id="invite-password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mvp-input w-full rounded-md px-3 py-2 text-sm"
              disabled={submitting}
              maxLength={200}
            />
            <p className="text-xs text-[var(--text-muted)]">Mínimo de 8 caracteres.</p>
          </div>

          {submitError ? (
            <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200" role="alert">
              {submitError}
            </p>
          ) : null}

          <button
            type="submit"
            className="mvp-btn-primary mt-1 w-full rounded-md px-4 py-2.5 text-sm font-medium"
            disabled={submitting || name.trim().length === 0 || password.length < 8}
          >
            {submitting ? "A criar conta…" : "Criar conta e entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
