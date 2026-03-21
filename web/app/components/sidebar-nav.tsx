"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItemId = "edit";

type NavItem = {
  id: NavItemId;
  label: string;
  shortLabel: string;
  href: string;
};

const NAV_ITEMS: NavItem[] = [
  { id: "edit", label: "Editor", shortLabel: "Timing", href: "/subtitle-file-edit" },
];

const NAV_GROUPS: { id: string; label: string; hint: string; itemIds: NavItemId[] }[] = [
  { id: "review", label: "Revisão", hint: "Editor ativo", itemIds: ["edit"] },
];

function itemById(id: NavItemId): NavItem {
  const found = NAV_ITEMS.find((i) => i.id === id);
  if (!found) throw new Error(`Nav item ${id}`);
  return found;
}

function getNavHref(item: NavItem): string {
  return item.href;
}

function isSidebarNavActive(item: NavItem, pathname: string): boolean {
  if (item.id === "edit") {
    return pathname.startsWith("/subtitle-file-edit");
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
    default:
      return null;
  }
}

export function SidebarNav({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = usePathname();

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
              const isActive = isSidebarNavActive(item, pathname);

              return (
                <li key={item.id}>
                  <Link
                    href={getNavHref(item)}
                    className="app-sidebar-link"
                    data-active={isActive ? "true" : "false"}
                    aria-current={isActive ? "page" : undefined}
                    title={collapsed ? item.label : undefined}
                  >
                    <span className="app-sidebar-link-icon" aria-hidden>
                      <NavIcon id={item.id} />
                    </span>
                    <span className="app-sidebar-link-text">
                      <span className="app-sidebar-link-label">{item.label}</span>
                      <span className="app-sidebar-link-meta">{item.shortLabel}</span>
                    </span>
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
