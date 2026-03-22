"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
} from "react";

export type ConfirmOptions = {
  /** Título curto (ex.: "Excluir projeto") */
  title: string;
  /** Texto explicativo — use "Confirma …?" quando fizer sentido */
  description?: string;
  /** Rótulo do botão afirmativo (predefinição: "Sim") */
  confirmLabel?: string;
  /** Rótulo do botão negativo (predefinição: "Não") */
  cancelLabel?: string;
  /** `danger`: botão Sim em vermelho (ex.: exclusão) */
  variant?: "default" | "danger";
};

type Pending = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

const ConfirmContext = createContext<
  ((opts: ConfirmOptions) => Promise<boolean>) | null
>(null);

/**
 * Abre o modal de confirmação global. Retorna `true` se o utilizador escolher **Sim**.
 *
 * @example
 * const confirm = useConfirm();
 * const ok = await confirm({
 *   title: "Excluir projeto",
 *   description: 'Confirma excluir "Nome"? Esta ação não pode ser desfeita.',
 *   variant: "danger",
 * });
 * if (!ok) return;
 */
export function useConfirm() {
  const fn = useContext(ConfirmContext);
  if (!fn) {
    throw new Error("useConfirm deve ser usado dentro de ConfirmProvider");
  }
  return fn;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);
  const titleId = useId();
  const descId = useId();

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({
        title: opts.title,
        description: opts.description,
        confirmLabel: opts.confirmLabel ?? "Sim",
        cancelLabel: opts.cancelLabel ?? "Não",
        variant: opts.variant ?? "default",
        resolve,
      });
    });
  }, []);

  const finish = useCallback((result: boolean) => {
    setPending((current) => {
      if (current) {
        current.resolve(result);
      }
      return null;
    });
  }, []);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        finish(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, finish]);

  const danger = pending?.variant === "danger";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending ? (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-[16px]"
          role="presentation"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/55"
            aria-label="Fechar"
            onClick={() => finish(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={pending.description ? descId : undefined}
            className="relative z-[1] w-full max-w-[400px] rounded-[10px] border border-[#2e2e2e] bg-[#1a1a1a] p-[20px] shadow-2xl"
          >
            <h2
              id={titleId}
              className="text-[15px] font-[600] leading-snug text-[#e8e8e8]"
            >
              {pending.title}
            </h2>
            {pending.description ? (
              <p
                id={descId}
                className="mt-[10px] text-[13px] leading-relaxed text-[#909090]"
              >
                {pending.description}
              </p>
            ) : null}
            <div className="mt-[20px] flex justify-end gap-[8px]">
              <button
                type="button"
                onClick={() => finish(false)}
                className="rounded-[6px] border border-[#2e2e2e] px-[14px] py-[7px] text-[12px] text-[#909090] transition-colors hover:bg-[#252525] hover:text-[#e8e8e8]"
              >
                {pending.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => finish(true)}
                className={`rounded-[6px] border px-[14px] py-[7px] text-[12px] font-[500] transition-colors ${
                  danger
                    ? "border-[#5a1515] bg-[#2a0a0a] text-[#F09595] hover:bg-[#3d0d0d]"
                    : "border-[#0F6E56] bg-[#1D9E75] text-white hover:bg-[#0F6E56]"
                }`}
              >
                {pending.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </ConfirmContext.Provider>
  );
}
