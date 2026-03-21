"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSidebarDisplay } from "./sidebar-display-context";

const ENGINE_LABEL = "Whisper / mock";

function IconSidebarToggle({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className="app-sidebar-recolher-icon"
    >
      <path
        d={collapsed ? "m9 18 6-6-6-6" : "m15 18-6-6 6-6"}
        stroke="currentColor"
        strokeWidth={2.25}
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

function IconUploadSmall() {
  return (
    <svg width={11} height={11} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"
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
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden>
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

function isGerarActive(pathname: string) {
  return pathname.startsWith("/gerar");
}

function isEditActive(pathname: string) {
  return pathname.startsWith("/subtitle-file-edit");
}

type Props = {
  collapsed: boolean;
  onToggle: () => void;
};

export function SidebarNav({ collapsed, onToggle }: Props) {
  const pathname = usePathname();
  const { editorFilename } = useSidebarDisplay();

  const timingLabel =
    editorFilename && editorFilename.trim().length > 0
      ? `Timing · ${editorFilename}`
      : "Timing";

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
        <IconSidebarToggle collapsed={collapsed} />
      </button>

      <div className="app-sidebar-brand-block">
        <Link
          href="/gerar"
          className="app-sidebar-brand-link"
          aria-label="Início — SubtitleStudio"
        >
          <div className="app-sidebar-brand-name">SubtitleStudio</div>
          <div className="app-sidebar-brand-sub">
            Workspace de revisão de legendas
          </div>
        </Link>
      </div>

      <nav
        id="app-sidebar-nav"
        className={`app-sidebar-nav-main ${collapsed ? "app-sidebar-nav-main--collapsed" : ""}`}
        aria-label="Navegação do workspace"
      >
        <span className="app-sidebar-group-label">GERAÇÃO</span>
        <div className="app-sidebar-nav-stack">
          <Link
            href="/gerar"
            className={`app-sidebar-nav-item${isGerarActive(pathname) ? " active" : ""}`}
            aria-current={isGerarActive(pathname) ? "page" : undefined}
            title={collapsed ? "Gerador SRT" : undefined}
          >
            <IconMic />
            <span className="app-sidebar-nav-item-label">Gerador SRT</span>
          </Link>
          <div className="app-sidebar-subitem" aria-hidden={collapsed}>
            <IconUploadSmall />
            <span>Lote · {ENGINE_LABEL}</span>
          </div>
        </div>

        <span className="app-sidebar-group-label">REVISÃO</span>
        <div className="app-sidebar-nav-stack">
          <Link
            href="/subtitle-file-edit"
            className={`app-sidebar-nav-item${isEditActive(pathname) ? " active" : ""}`}
            aria-current={isEditActive(pathname) ? "page" : undefined}
            title={collapsed ? "Editor" : undefined}
          >
            <IconPencil />
            <span className="app-sidebar-nav-item-label">Editor</span>
          </Link>
          <div className="app-sidebar-subitem" aria-hidden={collapsed}>
            <IconClockSmall />
            <span>{timingLabel}</span>
          </div>
        </div>
      </nav>

      <div className="app-sidebar-spacer" aria-hidden />

      <footer className="app-sidebar-footer">
        <Link href="/gerar" className="app-sidebar-footer-item">
          <IconGear />
          <span>Configurações</span>
        </Link>
      </footer>
    </>
  );
}
