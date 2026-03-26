"use client";

import {
  useEffect,
  useRef,
  useState,
  type AnimationEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { fetchAuthMe } from "@/src/lib/auth-client";
import { LoginWaveformCanvas } from "./login-waveform-canvas";
import "./login.css";

const POST_LOGIN_REDIRECT = "/projetos";

function LoginChrome({ children }: { children: ReactNode }) {
  return (
    <div className="login-page">
      <LoginWaveformCanvas className="login-page__canvas" />
      <div className="login-page__vignette" aria-hidden />
      {children}
    </div>
  );
}

export function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteComplete = searchParams.get("invite") === "complete";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailWrapRef = useRef<HTMLDivElement>(null);
  const passWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchAuthMe();
      if (cancelled) return;
      if (r.ok) {
        router.replace(POST_LOGIN_REDIRECT);
        return;
      }
      setCheckingSession(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  function shakeInputs() {
    emailWrapRef.current?.classList.add("login-input--shake");
    passWrapRef.current?.classList.add("login-input--shake");
  }

  function onInputWrapAnimEnd(e: AnimationEvent<HTMLDivElement>) {
    if (e.animationName === "login-shake") {
      e.currentTarget.classList.remove("login-input--shake");
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "Não foi possível entrar.",
        );
        shakeInputs();
        return;
      }
      router.replace(POST_LOGIN_REDIRECT);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (checkingSession) {
    return (
      <LoginChrome>
        <p className="login-page__loading">A verificar sessão…</p>
      </LoginChrome>
    );
  }

  return (
    <LoginChrome>
      <div className="login-page__card">
        <p className="login-page__eyebrow">
          <span className="login-page__eyebrow-dot" aria-hidden>
            ●
          </span>{" "}
          Subtitle Studio
        </p>
        <h1 className="login-page__title">ENTRAR</h1>
        <p className="login-page__subtitle">acesse sua conta para continuar</p>
        <div className="login-page__sep" aria-hidden />

        {inviteComplete ? (
          <p className="login-page__invite" role="status">
            Conta criada. Se a sessão não iniciou automaticamente, entre com o
            email e a senha que definiu.
          </p>
        ) : null}

        <form onSubmit={onSubmit} noValidate className="login-page__form">
          <div className="login-page__field login-page__field--1">
            <label htmlFor="login-email" className="login-page__label">
              Email
            </label>
            <div
              ref={emailWrapRef}
              className="login-page__input-wrap"
              onAnimationEnd={onInputWrapAnimEnd}
            >
              <input
                id="login-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="login-page__input"
                disabled={submitting}
                onInvalid={() => {
                  emailWrapRef.current?.classList.add("login-input--shake");
                }}
              />
            </div>
          </div>
          <div className="login-page__field login-page__field--2">
            <label htmlFor="login-password" className="login-page__label">
              Senha
            </label>
            <div
              ref={passWrapRef}
              className="login-page__input-wrap"
              onAnimationEnd={onInputWrapAnimEnd}
            >
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="login-page__input"
                disabled={submitting}
                onInvalid={() => {
                  passWrapRef.current?.classList.add("login-input--shake");
                }}
              />
            </div>
          </div>

          {error ? (
            <p className="login-page__error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="login-page__actions">
            <button
              type="submit"
              className="login-page__submit"
              disabled={submitting}
            >
              {submitting ? "A entrar…" : "Entrar →"}
            </button>
            <button
              type="button"
              className="login-page__forgot"
              disabled={submitting}
            >
              esqueci a senha
            </button>
          </div>
        </form>
      </div>
    </LoginChrome>
  );
}
