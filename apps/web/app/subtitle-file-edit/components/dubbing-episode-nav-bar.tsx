"use client";

import type { DubbingEpisodeDto } from "@/app/types/dubbing-episode";

type DubbingEpisodeNavBarProps = {
  currentEpisodeId: string;
  episodes: DubbingEpisodeDto[];
  loading: boolean;
  error: string | null;
  onSelectDoneEpisode: (ep: DubbingEpisodeDto) => void;
  onSaveAndComplete: () => void;
  saveCompleting: boolean;
  canSaveAndComplete: boolean;
};

export function DubbingEpisodeNavBar({
  currentEpisodeId,
  episodes,
  loading,
  error,
  onSelectDoneEpisode,
  onSaveAndComplete,
  saveCompleting,
  canSaveAndComplete,
}: DubbingEpisodeNavBarProps) {
  const total = episodes.length;
  const done = episodes.filter((e) => e.status === "DONE").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div
      className="dubbing-episode-nav shrink-0 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-2"
      data-testid="dubbing-episode-nav"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className="whitespace-nowrap text-[11px] font-medium text-[var(--text-muted)]">
            {done} de {total} concluídos — {pct}%
          </p>
          {loading ? (
            <span className="text-[11px] text-[var(--text-muted)]">
              Carregando episódios…
            </span>
          ) : error ? (
            <span className="text-[11px] text-red-400/90">{error}</span>
          ) : (
            <ul className="flex min-w-0 flex-wrap items-center gap-1.5">
              {episodes.map((ep) => {
                const label = ep.number;
                const isCurrent = ep.id === currentEpisodeId;
                if (isCurrent) {
                  return (
                    <li key={ep.id}>
                      <span
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--border-mid)] bg-[color-mix(in_srgb,var(--bg-surface)_80%,transparent)] px-2 py-0.5 font-mono text-[11px] font-semibold text-[var(--text-primary)]"
                        title={`Episódio atual · #${label}`}
                      >
                        <span aria-hidden>●</span>
                        <span>#{label}</span>
                      </span>
                    </li>
                  );
                }
                if (ep.status === "DONE" && ep.subtitleFileId) {
                  return (
                    <li key={ep.id}>
                      <button
                        type="button"
                        onClick={() => onSelectDoneEpisode(ep)}
                        className="inline-flex items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--bg-surface)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-primary)] transition-colors hover:border-[#1D9E75]/60 hover:bg-[color-mix(in_srgb,#1D9E75_12%,transparent)]"
                        title={`Abrir episódio #${label}`}
                      >
                        <span className="text-emerald-400/90" aria-hidden>
                          ✓
                        </span>
                        <span>#{label}</span>
                      </button>
                    </li>
                  );
                }
                return (
                  <li key={ep.id}>
                    <span
                      className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-dashed border-[var(--border)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-muted)] opacity-60"
                      title={`Episódio #${label} — indisponível`}
                    >
                      <span aria-hidden>○</span>
                      <span>#{label}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:justify-end">
          <button
            type="button"
            disabled={!canSaveAndComplete || saveCompleting}
            onClick={() => void onSaveAndComplete()}
            className="rounded-md border border-[#0F6E56] bg-[#1D9E75] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-[#0F6E56] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saveCompleting ? "A concluir…" : "Salvar e concluir"}
          </button>
        </div>
      </div>
    </div>
  );
}
