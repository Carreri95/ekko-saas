"use client";

import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  /** Pré-preenche o email (ex.: acção «Reenviar» na tabela). */
  initialEmail?: string;
  onSuccess: () => void;
};

function errorMessageFromBody(data: unknown): string {
  if (data && typeof data === "object" && "error" in data) {
    const e = (data as { error?: unknown }).error;
    if (typeof e === "string" && e.trim()) return e;
  }
  return "Pedido falhou";
}

export function InviteNewModal({
  open,
  onClose,
  initialEmail,
  onSuccess,
}: Props) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!open) return;
    setEmail(initialEmail?.trim() ?? "");
    setError(null);
    setLastInviteUrl(null);
    setClosing(false);
  }, [open, initialEmail]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (!closing) onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, closing]);

  function closeImmediately() {
    if (closing) return;
    onClose();
  }

  function closeWithAnimation() {
    if (closing) return;
    setClosing(true);
    // Pequeno delay para permitir “fade/slide out” antes de desmontar.
    window.setTimeout(() => {
      onClose();
    }, 220);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLastInviteUrl(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = (await res.json().catch(() => ({}))) as unknown;
      if (!res.ok) {
        setError(errorMessageFromBody(data));
        return;
      }
      const payload = data as { inviteUrl?: string };
      if (typeof payload.inviteUrl === "string" && payload.inviteUrl) {
        setLastInviteUrl(payload.inviteUrl);
      }
      onSuccess();
      closeWithAnimation();
    } catch {
      setError("Não foi possível criar o convite.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const inputCls =
    "w-full min-h-[34px] rounded-[5px] border border-[#2e2e2e] bg-[#111] px-[10px] py-[6px] text-[12px] text-[#e8e8e8] outline-none placeholder:text-[#505050] focus:border-[#1D9E75] transition-colors";
  const labelCls =
    "mb-[4px] block text-[10px] font-[600] uppercase tracking-[0.06em] text-[#505050]";

  return (
    <>
      <div
        className={`fixed inset-0 z-[60] bg-black/60 transition-opacity duration-200 ease-out ${
          closing ? "opacity-0" : "opacity-100"
        }`}
        onClick={closing ? undefined : onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="invite-modal-title"
        className={`fixed left-1/2 top-1/2 z-[70] w-[min(100vw-24px,400px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[10px] border border-[#2e2e2e] bg-[#1a1a1a] shadow-[0_16px_48px_rgba(0,0,0,0.6)] transition-all duration-200 ease-out ${
          closing ? "opacity-0 translate-y-2 scale-[0.98]" : "opacity-100"
        }`}
      >
        <div className="flex items-center justify-between border-b border-[#252525] px-[16px] py-[12px]">
          <span
            id="invite-modal-title"
            className="text-[13px] font-[600] text-[#e8e8e8]"
          >
            Convidar usuário
          </span>
          <button
            type="button"
            onClick={closeImmediately}
            className="flex h-[22px] w-[22px] items-center justify-center rounded-[4px] text-[16px] text-[#505050] transition-colors hover:bg-[#252525] hover:text-[#e8e8e8] disabled:opacity-50"
            aria-label="Fechar"
            disabled={closing}
          >
            ×
          </button>
        </div>
        <form
          onSubmit={onSubmit}
          noValidate
          className="flex flex-col gap-[10px] p-[16px]"
        >
          <div>
            <label className={labelCls} htmlFor="invite-modal-email">
              Email do convidado
            </label>
            <input
              id="invite-modal-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              className={inputCls}
              placeholder="email@exemplo.com"
              disabled={loading}
              autoFocus
            />
          </div>
          {error ? (
            <p className="text-[12px] text-[#f87171]" role="alert">
              {error}
            </p>
          ) : null}
          {lastInviteUrl ? (
            <div className="rounded-[5px] border border-[#333] bg-[#0f0f0f] p-3">
              <p className="mb-2 text-[11px] text-[var(--text-muted)]">
                Link do convite (copiar e enviar ao utilizador)
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <code className="max-w-full break-all text-[11px] text-[#a7f3d0]">
                  {lastInviteUrl}
                </code>
                <button
                  type="button"
                  className="shrink-0 rounded border border-[#444] px-2 py-1 text-[11px] text-[#e8e8e8] hover:bg-[#252525]"
                  onClick={() =>
                    void navigator.clipboard.writeText(lastInviteUrl)
                  }
                >
                  Copiar
                </button>
              </div>
            </div>
          ) : null}
          <div className="flex justify-end gap-[6px] border-t border-[#252525] pt-[10px]">
            <button
              type="button"
              onClick={closeImmediately}
              disabled={loading || closing}
              className="rounded-[5px] border border-[#2e2e2e] px-[12px] py-[6px] text-[11px] text-[#606060] transition-colors hover:bg-[#252525] disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading || closing || !email.trim()}
              className="rounded-[5px] border border-[#0F6E56] bg-[#1D9E75] px-[14px] py-[6px] text-[11px] font-[500] text-white transition-colors hover:bg-[#0F6E56] disabled:opacity-40"
            >
              {loading ? "A enviar…" : "Enviar convite"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
