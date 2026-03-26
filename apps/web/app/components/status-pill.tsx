"use client";

type StatusPillProps = {
  label: string;
  dot: string;
  border: string;
  bg: string;
  text: string;
};

/**
 * Badge padrão (pílula + ponto) usado em tabelas do produto.
 * Mantém exatamente o markup/casas CSS (`status-pill`, `status-pill-dot`) definido em `projetos.css`.
 */
export function StatusPill({ label, dot, border, bg, text }: StatusPillProps) {
  return (
    <span
      className="status-pill"
      style={{
        background: bg,
        border: `0.5px solid ${border}`,
        color: text,
      }}
    >
      <span className="status-pill-dot" style={{ background: dot }} />
      {label}
    </span>
  );
}

