"use client";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  className?: string;
};

/**
 * Campo de busca alinhado ao padrão da página de Projetos (ícone, borda, tipografia).
 */
export function ListSearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className = "w-[260px]",
}: Props) {
  return (
    <div
      className={`flex items-center gap-[6px] rounded-[6px] border border-[#252525] bg-[#111] px-[10px] py-[5px] ${className}`}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#404040"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        className="w-full bg-transparent text-[12px] text-[#e8e8e8] outline-none placeholder:text-[#404040]"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="text-[14px] text-[#404040] hover:text-[#909090]"
          aria-label="Limpar busca"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
