"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { SidebarNav } from "./sidebar-nav";

const STORAGE_KEY = "subtitlebot-sidebar-collapsed";

type SidebarContextValue = {
  collapsed: boolean;
  setCollapsed: (next: boolean) => void;
  toggle: () => void;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useAppSidebar() {
  return useContext(SidebarContext);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsedState] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      setCollapsedState(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const setCollapsed = useCallback((next: boolean) => {
    setCollapsedState(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setCollapsedState((c) => {
      const next = !c;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value: SidebarContextValue = { collapsed, setCollapsed, toggle };

  return (
    <SidebarContext.Provider value={value}>
      <div
        className={`app-shell-root ${ready && collapsed ? "app-shell-root--collapsed" : ""}`}
        data-sidebar-collapsed={ready && collapsed ? "true" : "false"}
      >
        <aside className={`app-sidebar ${ready && collapsed ? "app-sidebar--collapsed" : ""}`}>
          <div className="app-sidebar-toolbar">
            <button
              type="button"
              className="app-sidebar-toggle"
              onClick={toggle}
              aria-expanded={!collapsed}
              aria-controls="app-sidebar-nav"
              title={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
            >
              <span className="app-sidebar-toggle-icon" aria-hidden>
                {collapsed ? "»" : "«"}
              </span>
              <span className="app-sidebar-toggle-text">{collapsed ? "Menu" : "Recolher"}</span>
            </button>
          </div>
          <div className="app-sidebar-header">
            <Link
              href="/subtitle-file-edit"
              className="app-sidebar-brand-link"
              aria-label="Início — SubtitleBot"
            >
              <p className="app-brand">SubtitleBot</p>
              <p className="app-sidebar-subtitle">Workspace de revisão de legendas</p>
            </Link>
          </div>
          <SidebarNav collapsed={ready && collapsed} />
        </aside>

        <main className="app-main flex h-full min-h-0 min-w-0 flex-1 flex-col">{children}</main>
      </div>
    </SidebarContext.Provider>
  );
}
