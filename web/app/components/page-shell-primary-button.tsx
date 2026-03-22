"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "default" | "brand";

type PageShellPrimaryButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children"
> & {
  children: ReactNode;
  variant?: Variant;
};

const base =
  "inline-flex shrink-0 items-center justify-center gap-[6px] rounded-full px-[16px] py-[7px] text-[12px] font-[500] transition-colors";

const variants: Record<Variant, string> = {
  default:
    "border border-[#3a3a3a] bg-[#1a1a1a] text-[#e8e8e8] shadow-sm hover:border-[#505050] hover:bg-[#222]",
  brand:
    "border border-[#0F6E56] bg-[#1D9E75] text-white hover:bg-[#0F6E56]",
};

/**
 * Botão de ação primária para usar no conteúdo das páginas (pill / variante marca).
 */
export function PageShellPrimaryButton({
  children,
  className = "",
  variant = "default",
  type = "button",
  ...rest
}: PageShellPrimaryButtonProps) {
  return (
    <button
      type={type}
      className={`${base} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
