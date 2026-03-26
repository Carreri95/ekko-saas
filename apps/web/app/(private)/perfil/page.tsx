"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PageShell } from "@/app/components/page-shell";
import { usePrivateAuth } from "@/app/components/private-auth-provider";
import { AvatarCropModal } from "./components/avatar-crop-modal";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrador",
  USER: "Utilizador",
};

const inputCls =
  "w-full min-h-[36px] rounded-[6px] border border-[#2e2e2e] bg-[#111] px-[10px] py-[7px] text-[13px] text-[#e8e8e8] outline-none placeholder:text-[#505050] focus:border-[#1D9E75] transition-colors";
const labelCls =
  "mb-[5px] block text-[10px] font-[600] uppercase tracking-[0.07em] text-[#505050]";

function errorMessageFromBody(data: unknown): string {
  if (data && typeof data === "object" && "error" in data) {
    const e = (data as { error?: unknown }).error;
    if (typeof e === "string" && e.trim()) return e;
  }
  return "Não foi possível guardar.";
}

function getInitials(displayName: string | null, name: string | null, email: string | null): string {
  const base =
    displayName?.trim() ||
    name?.trim() ||
    email?.split("@")[0]?.trim() ||
    "?";
  return base
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]!.toUpperCase())
    .join("");
}

export default function PerfilPage() {
  const { user, refreshUser } = usePrivateAuth();
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setName(user.name ?? "");
    setDisplayName(user.displayName ?? "");
  }, [user]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() === "" ? null : name.trim().slice(0, 200),
          displayName:
            displayName.trim() === "" ? null : displayName.trim().slice(0, 200),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as unknown;
      if (!res.ok) {
        setError(errorMessageFromBody(data));
        return;
      }
      await refreshUser();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch {
      setError("Não foi possível guardar.");
    } finally {
      setSaving(false);
    }
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !f.type.startsWith("image/")) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(f);
    setPreviewUrl(url);
    setCropOpen(true);
  }

  function closeCropModal() {
    setCropOpen(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  }

  const initials = getInitials(user.displayName, user.name, user.email);
  const avatarSrc = user.avatarUrl?.trim() || null;

  return (
    <PageShell title="Perfil" section="gestao" subtitle="A sua conta">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        aria-hidden
        onChange={onFileChange}
      />
      <AvatarCropModal
        open={cropOpen}
        previewUrl={previewUrl}
        onClose={closeCropModal}
        onSaved={() => void refreshUser()}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-6">
        <div className="mx-auto w-full max-w-xl">
          <form
            onSubmit={onSubmit}
            noValidate
            className="rounded-lg border border-[#2a2a2a] bg-[#161616] px-5 py-5"
          >
            {success ? (
              <p
                className="mb-4 rounded-md border border-[#0F6E56]/40 bg-[#0d3d2a]/50 px-3 py-2 text-sm text-[#a7f3d0]"
                role="status"
              >
                Perfil actualizado.
              </p>
            ) : null}
            {error ? (
              <p className="mb-4 text-sm text-[#f87171]" role="alert">
                {error}
              </p>
            ) : null}

            <div className="mb-6 flex flex-col items-center">
              <button
                type="button"
                onClick={openFilePicker}
                className="group relative h-[96px] w-[96px] shrink-0 cursor-pointer overflow-hidden rounded-full border border-[#0F6E56] bg-[#0d3d2a] text-[28px] font-[600] text-[#5DCAA5] transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1D9E75] focus-visible:ring-offset-2 focus-visible:ring-offset-[#161616]"
                aria-label="Alterar foto de perfil"
              >
                {avatarSrc ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={avatarSrc}
                    alt=""
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">
                    {initials || "?"}
                  </span>
                )}
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 transition-colors group-hover:bg-black/50">
                  <span className="scale-90 opacity-0 transition-all group-hover:scale-100 group-hover:opacity-100">
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#e8e8e8"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                      <circle cx="12" cy="13" r="4" />
                    </svg>
                  </span>
                </span>
              </button>
              <p className="mt-2 text-center text-[11px] text-[#505050]">
                Clique para escolher uma imagem
              </p>
            </div>

            <div className="mb-4">
              <label className={labelCls} htmlFor="perfil-name">
                Nome
              </label>
              <input
                id="perfil-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputCls}
                disabled={saving}
              />
            </div>

            <div className="mb-4">
              <label className={labelCls} htmlFor="perfil-display">
                Nome de exibição
              </label>
              <input
                id="perfil-display"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className={inputCls}
                placeholder="Como prefere ser chamado na interface"
                disabled={saving}
              />
            </div>

            <div className="mb-4 rounded-md border border-[#252525] bg-[#141414] px-3 py-3">
              <div className={labelCls}>Email</div>
              <p className="text-[13px] text-[#909090]">{user.email ?? "—"}</p>
              <p className="mt-1 text-[11px] text-[#505050]">
                O email não pode ser alterado aqui.
              </p>
            </div>

            <div className="mb-6 rounded-md border border-[#252525] bg-[#141414] px-3 py-3">
              <div className={labelCls}>Função</div>
              <p className="text-[13px] text-[#909090]">
                {ROLE_LABEL[user.role] ?? user.role}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-md bg-[#0F6E56] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {saving ? "A guardar…" : "Guardar alterações"}
              </button>
              <Link
                href="/perfil/seguranca"
                className="text-[12px] text-[#909090] underline-offset-2 hover:text-[#e8e8e8] hover:underline"
              >
                Alterar senha
              </Link>
            </div>
          </form>
        </div>
      </div>
    </PageShell>
  );
}
