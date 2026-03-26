"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const RowMenuCloseContext = createContext<(() => void) | null>(null);

type Props = {
  /** Identificador estável para `aria-controls` / testes */
  ariaLabel: string;
  /** Conteúdo do painel (normalmente botões) */
  children: ReactNode;
  /** Se true, o gatilho não abre o menu */
  disabled?: boolean;
};

/**
 * Menu de ações por linha (•••), alinhado ao padrão da lista de episódios em `projetos/[id]/page.tsx`:
 * painel em `fixed` via portal, fecho por clique fora, Escape e scroll (capture).
 */
export function TableRowActionsMenu({
  ariaLabel,
  children,
  disabled = false,
}: Props) {
  const reactId = useId();
  const menuDomId = `row-menu-${reactId.replace(/:/g, "")}`;
  const [open, setOpen] = useState(false);
  const [fixed, setFixed] = useState<{ top: number; right: number } | null>(
    null,
  );

  const close = useCallback(() => {
    setOpen(false);
    setFixed(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const inside =
        t.closest(`[data-table-row-menu-root="${menuDomId}"]`) ||
        t.closest(`[data-table-row-menu-portal="${menuDomId}"]`);
      if (!inside) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close, menuDomId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => close();
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const onResize = () => close();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [open, close]);

  const closeCtx = useMemo(() => close, [close]);

  const panel =
    open &&
    fixed &&
    typeof document !== "undefined" &&
    !disabled ? (
      createPortal(
        <RowMenuCloseContext.Provider value={closeCtx}>
          <div
            id={menuDomId}
            data-table-row-menu-portal={menuDomId}
            role="menu"
            className="fixed z-[9999] min-w-[170px] overflow-hidden rounded-[8px] border border-[#2e2e2e] bg-[#141414] py-[2px] shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
            style={{ top: fixed.top, right: fixed.right }}
          >
            {children}
          </div>
        </RowMenuCloseContext.Provider>,
        document.body,
      )
    ) : null;

  return (
    <div
      className="relative flex justify-end"
      data-table-row-menu-root={menuDomId}
    >
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={open ? menuDomId : undefined}
        onClick={(e) => {
          e.stopPropagation();
          if (disabled) return;
          if (open) {
            close();
            return;
          }
          const rect = e.currentTarget.getBoundingClientRect();
          setFixed({
            top: rect.bottom + 6,
            right: window.innerWidth - rect.right,
          });
          setOpen(true);
        }}
        className="rounded-[5px] border border-[#2e2e2e] bg-[#141414] px-[9px] py-[5px] text-[12px] leading-none text-[#909090] transition-colors hover:bg-[#252525] hover:text-[#e8e8e8] disabled:cursor-not-allowed disabled:opacity-40"
      >
        •••
      </button>
      {panel}
    </div>
  );
}

/** Item de menu neutro (lista de episódios / tabelas). */
export function TableRowMenuItem({
  children,
  onSelect,
  disabled,
}: {
  children: ReactNode;
  onSelect: () => void | Promise<void>;
  disabled?: boolean;
}) {
  const closeMenu = useContext(RowMenuCloseContext);
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        closeMenu?.();
        void onSelect();
      }}
      className="block w-full px-[10px] py-[8px] text-left text-[11px] text-[#cfcfcf] transition-colors hover:bg-[#252525] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

/** Ação destrutiva (eliminar / revogar). */
export function TableRowMenuDangerItem({
  children,
  onSelect,
  disabled,
  withBorderTop = true,
}: {
  children: ReactNode;
  onSelect: () => void | Promise<void>;
  disabled?: boolean;
  /** Separador em relação ao item anterior (ex.: ação neutra por cima). */
  withBorderTop?: boolean;
}) {
  const closeMenu = useContext(RowMenuCloseContext);
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        closeMenu?.();
        void onSelect();
      }}
      className={`block w-full px-[10px] py-[8px] text-left text-[11px] text-[#F09595] transition-colors hover:bg-[#252525] disabled:cursor-not-allowed disabled:opacity-40 ${
        withBorderTop ? "border-t border-[#252525]" : ""
      }`}
    >
      {children}
    </button>
  );
}
