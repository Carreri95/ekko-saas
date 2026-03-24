"use client";

type Props = {
  total: number;
  done: number;
  running: number;
  pending: number;
};

export function BatchStatusBar({ total, done, running, pending }: Props) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="batch-gen-statusbar">
      <span>
        <strong>{total}</strong> arquivos
      </span>
      <span>
        <strong style={{ color: "var(--success-dot)" }}>{done}</strong> concluídos
      </span>
      <span>
        <strong style={{ color: "var(--warn-dot)" }}>{running}</strong> processando
      </span>
      <span>
        <strong>{pending}</strong> aguardando
      </span>
      <div className="batch-gen-progress-wrap">
        <div
          className="batch-gen-progress-bar"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span id="sb-fraction">
        {done} / {total}
      </span>
    </div>
  );
}
