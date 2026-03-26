"use client";

import type { ReactNode } from "react";
import { useOptionalPrivateAuth } from "./private-auth-provider";
import { UserMenu } from "./user-menu";

export type PageSection = "gestao" | "editor";

type PageShellProps = {
  title: string;
  subtitle?: string;
  /** Grupo da sidebar — define a cor do badge e do avatar */
  section?: PageSection;
  /** Barra secundária abaixo da topbar (filtros, tabs, etc.) */
  toolbar?: ReactNode;
  children: ReactNode;
  /** Para layouts fixos como o Editor (sem overflow-y: auto) */
  noScroll?: boolean;
};

const SECTION_META: Record<
  PageSection,
  { label: string; bg: string; border: string; text: string }
> = {
  gestao: {
    label: "Gestão",
    bg: "#0d3d2a",
    border: "#0F6E56",
    text: "#5DCAA5",
  },
  editor: {
    label: "Editor",
    bg: "#0d1f3d",
    border: "#1e4a7a",
    text: "#5B9BD5",
  },
};

/**
 * Wrapper padrão para páginas — topbar com badge de seção (opcional), título, UserMenu.
 * Na área privada, o menu usa o utilizador de `PrivateAuthProvider` (sessão via `/api/auth/me`).
 */
export function PageShell({
  title,
  subtitle,
  section,
  toolbar,
  children,
  noScroll = false,
}: PageShellProps) {
  const auth = useOptionalPrivateAuth();
  const meta = section ? SECTION_META[section] : null;
  const accent =
    section === "editor"
      ? {
          accentColor: "#5B9BD5",
          accentBg: "#0d1f3d",
          accentBorder: "#1e4a7a",
        }
      : section === "gestao"
        ? {
            accentColor: "#5DCAA5",
            accentBg: "#0d3d2a",
            accentBorder: "#0F6E56",
          }
        : undefined;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#0f0f0f]">
      <header className="relative box-border flex min-h-[56px] w-full min-w-0 shrink-0 items-center gap-3 border-b border-[#252525] bg-[#161616] px-6 py-3">
        {meta ? (
          <>
            <span
              style={{
                background: meta.bg,
                borderColor: meta.border,
                color: meta.text,
              }}
              className="inline-flex flex-shrink-0 items-center rounded-[6px] border px-3 py-1.5 text-[11px] font-[600] leading-tight"
            >
              {meta.label}
            </span>
            <div
              className="w-px flex-shrink-0 self-stretch bg-[#252525] min-h-[22px]"
              aria-hidden
            />
          </>
        ) : null}

        <h1 className="shrink-0 text-[17px] font-[600] leading-tight text-[#e8e8e8]">
          {title}
        </h1>
        {subtitle ? (
          <span className="shrink-0 pl-1 text-[12px] text-[#404040]">
            {subtitle}
          </span>
        ) : null}
        <div className="flex-1" />
        <UserMenu
          user={
            auth
              ? {
                  name:
                    auth.user.displayName?.trim() ||
                    auth.user.name?.trim() ||
                    auth.user.email ||
                    "Utilizador",
                  email: auth.user.email ?? "",
                  role: auth.user.role,
                  avatarUrl: auth.user.avatarUrl,
                }
              : undefined
          }
          {...(accent ?? {})}
          onSignOut={auth ? () => auth.signOut() : undefined}
        />
      </header>

      {toolbar ? (
        <div className="shrink-0 border-b border-[#1e1e1e] bg-[#141414]">
          {toolbar}
        </div>
      ) : null}

      <div
        className={`min-h-0 flex-1 ${noScroll ? "overflow-hidden" : "overflow-y-auto"}`}
      >
        {children}
      </div>
    </div>
  );
}
