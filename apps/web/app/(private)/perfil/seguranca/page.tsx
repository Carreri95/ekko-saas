"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageShell } from "@/app/components/page-shell";
import { useConfirm } from "@/app/components/confirm-provider";

const inputCls =
  "w-full min-h-[36px] rounded-[6px] border border-[#2e2e2e] bg-[#111] px-[10px] py-[7px] text-[13px] text-[#e8e8e8] outline-none placeholder:text-[#505050] focus:border-[#1D9E75] transition-colors";
const labelCls =
  "mb-[5px] block text-[10px] font-[600] uppercase tracking-[0.07em] text-[#505050]";

function errorMessageFromBody(data: unknown): string {
  if (data && typeof data === "object" && "error" in data) {
    const e = (data as { error?: unknown }).error;
    if (typeof e === "string" && e.trim()) return e;
  }
  return "Não foi possível alterar a senha.";
}

export default function PerfilSegurancaPage() {
  const confirm = useConfirm();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [keyLoading, setKeyLoading] = useState(true);
  const [hasSavedKey, setHasSavedKey] = useState(false);
  const [maskedKey, setMaskedKey] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [keySaving, setKeySaving] = useState(false);
  const [keyRemoving, setKeyRemoving] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keySuccess, setKeySuccess] = useState<string | null>(null);

  const loadKeyStatus = useCallback(async () => {
    setKeyLoading(true);
    setKeyError(null);
    try {
      const res = await fetch("/api/auth/openai-key", {
        credentials: "include",
        cache: "no-store",
      });
      const data = (await res.json().catch(() => ({}))) as {
        hasKey?: unknown;
        masked?: unknown;
        error?: unknown;
      };
      if (!res.ok) {
        setKeyError(errorMessageFromBody(data));
        setHasSavedKey(false);
        setMaskedKey(null);
        return;
      }
      setHasSavedKey(Boolean(data.hasKey));
      setMaskedKey(typeof data.masked === "string" ? data.masked : null);
    } catch {
      setKeyError("Não foi possível carregar o estado da chave OpenAI.");
      setHasSavedKey(false);
      setMaskedKey(null);
    } finally {
      setKeyLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadKeyStatus();
  }, [loadKeyStatus]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError("As senhas novas não coincidem.");
      return;
    }
    if (newPassword.length < 8) {
      setError("A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as unknown;
      if (!res.ok) {
        setError(errorMessageFromBody(data));
        return;
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
    } catch {
      setError("Não foi possível alterar a senha.");
    } finally {
      setSaving(false);
    }
  }

  async function onSaveApiKey(e: React.FormEvent) {
    e.preventDefault();
    setKeyError(null);
    setKeySuccess(null);
    const apiKey = apiKeyInput.trim();
    if (apiKey.length < 20) {
      setKeyError("Chave OpenAI inválida.");
      return;
    }
    setKeySaving(true);
    try {
      const res = await fetch("/api/auth/openai-key", {
        method: "PUT",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        hasKey?: unknown;
        masked?: unknown;
        error?: unknown;
      };
      if (!res.ok) {
        setKeyError(errorMessageFromBody(data));
        return;
      }
      setHasSavedKey(Boolean(data.hasKey));
      setMaskedKey(typeof data.masked === "string" ? data.masked : null);
      setApiKeyInput("");
      setKeySuccess("Chave OpenAI guardada com sucesso.");
    } catch {
      setKeyError("Não foi possível guardar a chave OpenAI.");
    } finally {
      setKeySaving(false);
    }
  }

  async function onRemoveApiKey() {
    setKeyError(null);
    setKeySuccess(null);
    const ok = await confirm({
      title: "Remover chave OpenAI",
      description:
        "Confirma remover a chave OpenAI guardada na sua conta? Geração de SRT poderá falhar sem fallback de sistema.",
      variant: "danger",
      confirmLabel: "Sim, remover",
    });
    if (!ok) return;
    setKeyRemoving(true);
    try {
      const res = await fetch("/api/auth/openai-key", {
        method: "DELETE",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: unknown;
      };
      if (!res.ok) {
        setKeyError(errorMessageFromBody(data));
        return;
      }
      setHasSavedKey(false);
      setMaskedKey(null);
      setKeySuccess("Chave OpenAI removida.");
    } catch {
      setKeyError("Não foi possível remover a chave OpenAI.");
    } finally {
      setKeyRemoving(false);
    }
  }

  return (
    <PageShell title="Segurança" section="gestao" subtitle="Palavra-passe">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6">
        <div className="mx-auto mb-4 w-full max-w-xl text-[11px] text-[#505050]">
          <Link
            href="/perfil"
            className="text-[#909090] hover:text-[#e8e8e8] hover:underline"
          >
            ← Perfil
          </Link>
        </div>
        <div className="mx-auto mb-4 w-full max-w-xl rounded-lg border border-[#2a2a2a] bg-[#161616] px-5 py-5">
          <h2 className="mb-3 text-[13px] font-[600] text-[#e8e8e8]">
            Chave OpenAI (Whisper)
          </h2>
          {keySuccess ? (
            <p
              className="mb-4 rounded-md border border-[#0F6E56]/40 bg-[#0d3d2a]/50 px-3 py-2 text-sm text-[#a7f3d0]"
              role="status"
            >
              {keySuccess}
            </p>
          ) : null}
          {keyError ? (
            <p className="mb-4 text-sm text-[#f87171]" role="alert">
              {keyError}
            </p>
          ) : null}
          <p className="mb-3 text-[12px] text-[#909090]">
            {keyLoading
              ? "A carregar estado da chave..."
              : hasSavedKey
                ? `Chave guardada: ${maskedKey ?? "configurada"}`
                : "Nenhuma chave guardada na conta."}
          </p>
          <form onSubmit={onSaveApiKey} className="mb-3" noValidate>
            <label className={labelCls} htmlFor="openai-key">
              {hasSavedKey ? "Substituir chave" : "Guardar chave"}
            </label>
            <input
              id="openai-key"
              type="password"
              autoComplete="off"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              className={inputCls}
              placeholder="sk-..."
              disabled={keySaving || keyRemoving}
            />
            <div className="mt-3 flex items-center gap-2">
              <button
                type="submit"
                disabled={keySaving || keyRemoving}
                className="rounded-md bg-[#0F6E56] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {keySaving ? "A guardar…" : hasSavedKey ? "Substituir chave" : "Guardar chave"}
              </button>
              {hasSavedKey ? (
                <button
                  type="button"
                  onClick={() => void onRemoveApiKey()}
                  disabled={keySaving || keyRemoving}
                  className="rounded-md border border-[#5a1515] bg-[#2a0a0a] px-4 py-2 text-sm font-medium text-[#F09595] disabled:opacity-50"
                >
                  {keyRemoving ? "A remover…" : "Remover chave"}
                </button>
              ) : null}
            </div>
          </form>
          <p className="text-[11px] text-[#606060]">
            A chave é guardada no servidor de forma segura e nunca é devolvida completa ao browser.
          </p>
        </div>

        <div className="mx-auto w-full max-w-xl">
          <form
            onSubmit={onSubmit}
            noValidate
            className="rounded-lg border border-[#2a2a2a] bg-[#161616] px-5 py-5"
          >
            <h2 className="mb-3 text-[13px] font-[600] text-[#e8e8e8]">Senha</h2>
            {success ? (
              <p
                className="mb-4 rounded-md border border-[#0F6E56]/40 bg-[#0d3d2a]/50 px-3 py-2 text-sm text-[#a7f3d0]"
                role="status"
              >
                Senha alterada com sucesso.
              </p>
            ) : null}
            {error ? (
              <p className="mb-4 text-sm text-[#f87171]" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mb-4">
              <label className={labelCls} htmlFor="pwd-current">
                Senha actual
              </label>
              <input
                id="pwd-current"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputCls}
                disabled={saving}
                required
              />
            </div>
            <div className="mb-4">
              <label className={labelCls} htmlFor="pwd-new">
                Nova senha
              </label>
              <input
                id="pwd-new"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputCls}
                disabled={saving}
                required
                minLength={8}
              />
            </div>
            <div className="mb-6">
              <label className={labelCls} htmlFor="pwd-confirm">
                Confirmar nova senha
              </label>
              <input
                id="pwd-confirm"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputCls}
                disabled={saving}
                required
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-[#0F6E56] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? "A actualizar…" : "Alterar senha"}
            </button>
          </form>
        </div>
      </div>
    </PageShell>
  );
}
