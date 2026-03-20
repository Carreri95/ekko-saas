"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type NavItemId = "edit" | "history";

type NavItem = {
  id: NavItemId;
  label: string;
  shortLabel: string;
  href: string;
  /** Atalho para secção (#) — destaque visual mais leve */
  kind: "route" | "section";
};

const NAV_ITEMS: NavItem[] = [
  { id: "edit", label: "Editor", shortLabel: "Timing", href: "/subtitle-file-edit", kind: "route" },
  {
    id: "history",
    label: "Histórico",
    shortLabel: "Versões",
    href: "/subtitle-file-edit#historico-versoes",
    kind: "section",
  },
];

const NAV_GROUPS: { id: string; label: string; hint: string; itemIds: NavItemId[] }[] = [
  { id: "review", label: "Revisão", hint: "Editor ativo", itemIds: ["edit", "history"] },
];

function itemById(id: NavItemId): NavItem {
  const found = NAV_ITEMS.find((i) => i.id === id);
  if (!found) throw new Error(`Nav item ${id}`);
  return found;
}

function getNavHref(item: NavItem, pathname: string): string {
  return item.href;
}

function isSidebarNavActive(item: NavItem, pathname: string, hash: string): boolean {
  const h = hash || "";
  if (item.id === "edit") {
    return (
      pathname.startsWith("/subtitle-file-edit") &&
      h !== "#historico-versoes"
    );
  }
  if (item.id === "history") {
    return pathname.startsWith("/subtitle-file-edit") && h === "#historico-versoes";
  }
  return false;
}

function NavIcon({ id }: { id: NavItemId }) {
  const common = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none" as const, "aria-hidden": true as const };
  switch (id) {
    case "edit":
      return (
        <svg {...common}>
          <path
            d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "history":
      return (
        <svg {...common}>
          <path
            d="M3 12a9 9 0 1 0 3-7.2M3 3v6h6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

export function SidebarNav({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();
  const [hash, setHash] = useState("");

  useEffect(() => {
    const sync = () => {
      if (typeof window === "undefined") return;
      setHash(window.location.hash);
    };
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [pathname]);

  return (
    <nav
      id="app-sidebar-nav"
      className={`app-sidebar-nav ${collapsed ? "app-sidebar-nav--collapsed" : ""}`}
      aria-label="Navegação do workspace"
    >
      {NAV_GROUPS.map((group, groupIndex) => (
        <div
          key={group.id}
          className={`app-sidebar-nav-group ${groupIndex > 0 ? "app-sidebar-nav-group--spaced" : ""}`}
        >
          <div className="app-sidebar-nav-group-head">
            <span className="app-sidebar-nav-group-label">{group.label}</span>
            <span className="app-sidebar-nav-group-hint">{group.hint}</span>
          </div>
          <ul className="app-sidebar-nav-list" role="list">
            {group.itemIds.map((itemId) => {
              const item = itemById(itemId);
              const isActive = isSidebarNavActive(item, pathname, hash);
              const isSection = item.kind === "section";

              return (
                <li key={item.id}>
                  <Link
                    href={getNavHref(item, pathname)}
                    className={`app-sidebar-link ${isSection ? "app-sidebar-link--section" : ""}`}
                    data-active={isActive ? "true" : "false"}
                    aria-current={isActive ? "page" : undefined}
                    title={
                      collapsed
                        ? item.label
                        : isSection
                          ? `${item.label} — atalho para secção na página`
                          : undefined
                    }
                  >
                    <span className="app-sidebar-link-icon" aria-hidden>
                      <NavIcon id={item.id} />
                    </span>
                    <span className="app-sidebar-link-text">
                      <span className="app-sidebar-link-label">{item.label}</span>
                      <span className="app-sidebar-link-meta">{item.shortLabel}</span>
                    </span>
                    {isSection ? (
                      <span className="app-sidebar-link-pill" aria-hidden>
                        #
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
