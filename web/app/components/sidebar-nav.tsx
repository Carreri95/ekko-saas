"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebarDisplay } from "./sidebar-display-context";

function IconCollapseChevron({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width={12}
      height={12}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className="app-sidebar-recolher-icon"
    >
      {collapsed ? (
        <path
          d="M6 3l5 5-5 5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M10 3L5 8l5 5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}

function IconGrid() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function IconBriefcase() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg
      width={15}
      height={15}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function IconPencil() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m16 3 4 4L9 18H5v-4z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconMic() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClockSmall() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
      <polyline
        points="12 6 12 12 16 14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconGear() {
  return (
    <svg
      width={13}
      height={13}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

type NavIconId = "grid" | "users" | "briefcase" | "calendar" | "edit" | "mic";

function NavItemIcon({ id }: { id: NavIconId }) {
  switch (id) {
    case "grid":
      return <IconGrid />;
    case "users":
      return <IconUsers />;
    case "briefcase":
      return <IconBriefcase />;
    case "calendar":
      return <IconCalendar />;
    case "edit":
      return <IconPencil />;
    case "mic":
      return <IconMic />;
    default:
      return null;
  }
}

function isActivePath(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

type Props = {
  collapsed: boolean;
  onToggle: () => void;
};

export function SidebarNav({ collapsed, onToggle }: Props) {
  const pathname = usePathname();
  const { editorFilename } = useSidebarDisplay();

  const activeFileName =
    editorFilename && editorFilename.trim().length > 0
      ? editorFilename.trim()
      : null;

  const showEditorTimingSub = Boolean(activeFileName);

  return (
    <>
      <button
        type="button"
        className="app-sidebar-recolher"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-controls="app-sidebar-nav"
        aria-label={
          collapsed ? "Expandir barra lateral" : "Recolher barra lateral"
        }
        title={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
      >
        <IconCollapseChevron collapsed={collapsed} />
        {!collapsed ? (
          <span className="app-sidebar-recolher-label">Recolher</span>
        ) : null}
      </button>

      <div className="app-sidebar-brand-block">
        <Link
          href="/gerar"
          className="app-sidebar-brand-link"
          aria-label="Início — SubtitleStudio"
        >
          <div className="app-sidebar-brand-name">SubtitleStudio</div>
          <div className="app-sidebar-brand-sub">Estúdio de dublagem</div>
        </Link>
      </div>

      <nav
        id="app-sidebar-nav"
        className="app-sidebar-nav-main"
        aria-label="Navegação do workspace"
      >
        {/* GESTÃO */}
        <div className="app-sidebar-nav-stack">
          <span className="app-sidebar-group-label">Gestão</span>
          <Link
            href="/projetos"
            className={`app-sidebar-nav-item${isActivePath(pathname, "/projetos") ? " active" : ""}`}
            aria-current={
              isActivePath(pathname, "/projetos") ? "page" : undefined
            }
            title={collapsed ? "Projetos" : undefined}
          >
            <NavItemIcon id="grid" />
            <span className="app-sidebar-nav-item-label">Projetos</span>
          </Link>
          <Link
            href="/elenco"
            className={`app-sidebar-nav-item${isActivePath(pathname, "/elenco") ? " active" : ""}`}
            aria-current={
              isActivePath(pathname, "/elenco") ? "page" : undefined
            }
            title={collapsed ? "Elenco" : undefined}
          >
            <NavItemIcon id="users" />
            <span className="app-sidebar-nav-item-label">Elenco</span>
          </Link>
          <Link
            href="/clientes"
            className={`app-sidebar-nav-item${isActivePath(pathname, "/clientes") ? " active" : ""}`}
            aria-current={
              isActivePath(pathname, "/clientes") ? "page" : undefined
            }
            title={collapsed ? "Clientes" : undefined}
          >
            <NavItemIcon id="briefcase" />
            <span className="app-sidebar-nav-item-label">Clientes</span>
          </Link>
          <Link
            href="/agenda"
            className={`app-sidebar-nav-item${isActivePath(pathname, "/agenda") ? " active" : ""}`}
            aria-current={
              isActivePath(pathname, "/agenda") ? "page" : undefined
            }
            title={collapsed ? "Agenda" : undefined}
          >
            <NavItemIcon id="calendar" />
            <span className="app-sidebar-nav-item-label">Agenda</span>
          </Link>
        </div>

        {collapsed ? (
          <div className="app-sidebar-group-sep" aria-hidden />
        ) : null}

        {/* EDITOR */}
        <div className="app-sidebar-nav-stack">
          <span className="app-sidebar-group-label">Editor</span>
          <Link
            href="/subtitle-file-edit"
            className={`app-sidebar-nav-item${isActivePath(pathname, "/subtitle-file-edit") ? " active" : ""}`}
            aria-current={
              isActivePath(pathname, "/subtitle-file-edit")
                ? "page"
                : undefined
            }
            title={collapsed ? "Editor" : undefined}
          >
            <NavItemIcon id="edit" />
            <span className="app-sidebar-nav-item-label">Editor</span>
          </Link>
          {showEditorTimingSub ? (
            <div className="app-sidebar-subitem" aria-hidden={collapsed}>
              <IconClockSmall />
              <span>Timing · {activeFileName}</span>
            </div>
          ) : null}
          <Link
            href="/gerar"
            className={`app-sidebar-nav-item${isActivePath(pathname, "/gerar") ? " active" : ""}`}
            aria-current={isActivePath(pathname, "/gerar") ? "page" : undefined}
            title={collapsed ? "Gerador SRT" : undefined}
          >
            <NavItemIcon id="mic" />
            <span className="app-sidebar-nav-item-label">Gerador SRT</span>
          </Link>
        </div>
      </nav>

      <div className="app-sidebar-spacer" aria-hidden />

      <footer className="app-sidebar-footer">
        <Link href="/configuracoes" className="app-sidebar-footer-item">
          <IconGear />
          <span>Configurações</span>
        </Link>
      </footer>
    </>
  );
}
