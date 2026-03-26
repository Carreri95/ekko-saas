"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { ConfirmProvider } from "./confirm-provider";
import { SidebarDisplayProvider } from "./sidebar-display-context";
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
  const pathname = usePathname();
  const hideSidebar = pathname === "/login";
  const [collapsed, setCollapsedState] = useState(false);

  useEffect(() => {
    try {
      setCollapsedState(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setCollapsedState(false);
    }
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

  const shellClass =
    hideSidebar
      ? "app-shell-root app-shell-root--no-sidebar"
      : `app-shell-root ${collapsed ? "app-shell-root--collapsed" : ""}`;

  return (
    <SidebarDisplayProvider>
      <ConfirmProvider>
        <SidebarContext.Provider value={value}>
          <div
            className={shellClass}
            data-sidebar-collapsed={hideSidebar ? "false" : collapsed ? "true" : "false"}
            data-no-sidebar={hideSidebar ? "true" : "false"}
          >
            {hideSidebar ? null : (
              <aside
                className={`app-sidebar ${collapsed ? "app-sidebar--collapsed" : ""}`}
              >
                <SidebarNav collapsed={collapsed} onToggle={toggle} />
              </aside>
            )}

            <main className="app-main flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {children}
            </main>
          </div>
        </SidebarContext.Provider>
      </ConfirmProvider>
    </SidebarDisplayProvider>
  );
}
