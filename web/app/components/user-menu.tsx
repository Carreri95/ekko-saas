"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type UserMenuProps = {
  user?: { name: string; email: string; plan?: string };
  /** Quando definidos (ex.: via PageShell + section), avatar e badge do menu seguem a paleta */
  accentColor?: string;
  accentBg?: string;
  accentBorder?: string;
  onSignOut?: () => void;
};

const DEFAULT_USER = {
  name: "Usuário",
  email: "usuario@estudio.com.br",
  plan: "Free",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0]!.toUpperCase())
    .join("");
}

export function UserMenu({
  user = DEFAULT_USER,
  accentColor,
  accentBg,
  accentBorder,
  onSignOut,
}: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  const initials = getInitials(user.name);
  const hasAccent =
    accentColor != null && accentBg != null && accentBorder != null;

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu do usuário"
        aria-expanded={open}
        aria-haspopup="menu"
        className={
          hasAccent
            ? "flex h-[32px] w-[32px] items-center justify-center rounded-full border text-[12px] font-[600] transition-opacity hover:opacity-90"
            : `flex h-[32px] w-[32px] items-center justify-center rounded-full border text-[12px] font-[600] transition-colors ${
                open
                  ? "border-[#0F6E56] bg-[#0d3d2a] text-[#5DCAA5]"
                  : "border-[#333] bg-[#252525] text-[#909090] hover:border-[#444] hover:bg-[#2a2a2a] hover:text-[#e8e8e8]"
              }`
        }
        style={
          hasAccent
            ? {
                background: accentBg,
                borderColor: accentBorder,
                color: accentColor,
              }
            : undefined
        }
      >
        {initials || (
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        )}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[220px] overflow-hidden rounded-[8px] border border-[#2e2e2e] bg-[#1e1e1e] shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
        >
          <div className="border-b border-[#252525] px-[12px] pb-[10px] pt-[12px]">
            <div
              className="mb-[8px] flex h-[36px] w-[36px] items-center justify-center rounded-full border text-[13px] font-[600]"
              style={
                hasAccent
                  ? {
                      background: accentBg,
                      borderColor: accentBorder,
                      color: accentColor,
                    }
                  : {
                      background: "#0d3d2a",
                      borderColor: "#0F6E56",
                      color: "#5DCAA5",
                    }
              }
            >
              {initials || "?"}
            </div>
            <div className="text-[13px] font-[500] text-[#e8e8e8]">
              {user.name}
            </div>
            <div className="mt-[1px] text-[11px] text-[#505050]">{user.email}</div>
            {user.plan ? (
              <div
                className="mt-[6px] inline-flex items-center gap-[3px] rounded-[99px] border px-[7px] py-[2px] text-[9px] font-[600]"
                style={
                  hasAccent
                    ? {
                        background: accentBg,
                        borderColor: accentBorder,
                        color: accentColor,
                      }
                    : {
                        background: "#0d3d2a",
                        borderColor: "#0F6E56",
                        color: "#5DCAA5",
                      }
                }
              >
                <svg width="8" height="8" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
                  <path d="M8 1l2 5h5l-4 3 1.5 5L8 11l-4.5 3L5 9 1 6h5z" />
                </svg>
                {user.plan}
              </div>
            ) : null}
          </div>

          <div className="p-[4px]">
            <MenuItem href="/perfil" icon={<IconUser />} onClick={() => setOpen(false)}>
              Meu perfil
            </MenuItem>
            <MenuItem
              href="/configuracoes"
              icon={<IconSettings />}
              onClick={() => setOpen(false)}
            >
              Configurações da conta
            </MenuItem>
            <MenuItem
              href="/configuracoes/seguranca"
              icon={<IconShield />}
              onClick={() => setOpen(false)}
            >
              Segurança
            </MenuItem>

            <div className="my-[4px] h-px bg-[#252525]" aria-hidden />

            <MenuItem href="/suporte" icon={<IconSupport />} onClick={() => setOpen(false)}>
              Suporte
            </MenuItem>

            <div className="my-[4px] h-px bg-[#252525]" aria-hidden />

            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-[8px] rounded-[5px] px-[12px] py-[7px] text-[12px] text-[#606060] transition-colors hover:bg-[#2a0a0a] hover:text-[#F09595]"
              onClick={() => {
                setOpen(false);
                onSignOut?.();
              }}
            >
              <IconSignOut />
              Sair
            </button>
          </div>

          <div className="flex items-center justify-between border-t border-[#252525] px-[12px] py-[6px]">
            <span className="text-[10px] text-[#404040]">SubtitleStudio</span>
            <span className="text-[10px] text-[#404040]">v0.1.0</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuItem({
  href,
  icon,
  children,
  onClick,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-[8px] rounded-[5px] px-[12px] py-[7px] text-[12px] text-[#909090] transition-colors hover:bg-[#252525] hover:text-[#e8e8e8]"
    >
      {icon}
      {children}
    </Link>
  );
}

function IconUser() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 opacity-70"
      aria-hidden
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className="shrink-0 opacity-70"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 opacity-70"
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

function IconSupport() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 opacity-70"
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconSignOut() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
      aria-hidden
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
