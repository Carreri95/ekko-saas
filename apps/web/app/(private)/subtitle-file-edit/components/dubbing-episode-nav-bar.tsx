"use client";

import { useRouter } from "next/navigation";
import type { DubbingEpisodeDto } from "@/app/types/dubbing-episode";
import type { DubbingProjectStatus } from "../../projetos/domain";
import { StatusPill } from "@/app/components/status-pill";

type DubbingEpisodeNavBarProps = {
  currentEpisodeId: string;
  episodes: DubbingEpisodeDto[];
  loading: boolean;
  error: string | null;
  onSelectDoneEpisode: (ep: DubbingEpisodeDto) => void;
  onSaveAndComplete: () => void;
  saveCompleting: boolean;
  canSaveAndComplete: boolean;
  /**
   * Conteúdo do topo do editor (atualiza somente UI; não altera lógica de save/processamento SRT).
   * Quando `showEditorToolbar` é false, o header fica apenas com a navegação/progresso de episódios.
   */
  showEditorToolbar?: boolean;
  editorFilename?: string | null;
  editorCuesCount?: number;
  editorWavFilename?: string | null;
  editorLoading?: boolean;
  editorSaving?: boolean;
  editorExporting?: boolean;
  editorSaveSuccess?: string | null;
  editorError?: string | null;
  /** Contexto mínimo do projeto para breadcrumb + badge da fase. */
  projectId?: string;
  projectName?: string | null;
  projectStatus?: DubbingProjectStatus | null;
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
  showEditorToolbar = false,
  editorFilename,
  editorCuesCount,
  editorWavFilename,
  editorLoading = false,
  editorSaving = false,
  editorExporting = false,
  editorSaveSuccess = null,
  editorError = null,
  projectId,
  projectName,
  projectStatus,
}: DubbingEpisodeNavBarProps) {
  const router = useRouter();
  const total = episodes.length;
  const done = episodes.filter((e) => e.status === "DONE").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const currentEpisode = episodes.find((e) => e.id === currentEpisodeId);
  const currentEpisodeNumber = currentEpisode?.number ?? 0;
  const currentEpisodeTitle =
    currentEpisode?.title?.trim() || `Episódio ${currentEpisodeNumber}`;

  const STATUS_PILL: Record<
    DubbingProjectStatus,
    {
      label: string;
      dot: string;
      border: string;
      bg: string;
      text: string;
    }
  > = {
    SPOTTING: {
      label: "Spotting",
      dot: "#5B9BD5",
      border: "#5B9BD5",
      bg: "rgba(91,155,213,0.12)",
      text: "#8BB4E5",
    },
    ADAPTATION: {
      label: "Adaptação",
      dot: "#BA7517",
      border: "#BA7517",
      bg: "rgba(186,117,23,0.12)",
      text: "#E5A84A",
    },
    REVIEW: {
      label: "Revisão",
      dot: "#A78BFA",
      border: "#A78BFA",
      bg: "rgba(167,139,250,0.12)",
      text: "#C4B0FC",
    },
    RECORDING: {
      label: "Em gravação",
      dot: "#1D9E75",
      border: "#1D9E75",
      bg: "rgba(29,158,117,0.12)",
      text: "#5DCAA5",
    },
    DELIVERY: {
      label: "Entrega",
      dot: "#FBBF24",
      border: "#FBBF24",
      bg: "rgba(251,191,36,0.12)",
      text: "#FCD34D",
    },
    DONE: {
      label: "Concluído",
      dot: "#4ade80",
      border: "#4ade80",
      bg: "rgba(74,222,128,0.12)",
      text: "#86EFAC",
    },
    PAUSED: {
      label: "Pausado",
      dot: "#555555",
      border: "#555555",
      bg: "rgba(85,85,85,0.18)",
      text: "#909090",
    },
  };

  const pill = (projectStatus ? STATUS_PILL[projectStatus] : undefined) ?? {
    label: "—",
    dot: "#606060",
    border: "#606060",
    bg: "rgba(96,96,96,0.15)",
    text: "#909090",
  };

  function hexToRgba(hex: string, alpha: number) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return `rgba(96,96,96,${alpha})`;
    const r = parseInt(m[1], 16);
    const g = parseInt(m[2], 16);
    const b = parseInt(m[3], 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  return (
    <div
      className="dubbing-episode-nav shrink-0 border-b border-[var(--border)] bg-[var(--bg-elevated)] px-3 py-1.5"
      data-testid="dubbing-episode-nav"
    >
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(280px,1fr)_auto] sm:items-center">
        {/* Zona esquerda: breadcrumb + badge fase + chips de episódios */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              {/* Desktop breadcrumb */}
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                <button
                  type="button"
                  onClick={() => router.push("/projetos")}
                  className="hover:text-[#e8e8e8] transition-colors"
                >
                  Projetos
                </button>
                <span aria-hidden className="text-[#404040]">
                  →
                </span>
                {projectId ? (
                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        `/projetos/${encodeURIComponent(projectId)}?tab=episodios`,
                      )
                    }
                    className="truncate hover:text-[#e8e8e8] transition-colors max-w-[180px]"
                    title={projectName ?? undefined}
                  >
                    {projectName ?? "—"}
                  </button>
                ) : (
                  <span className="truncate max-w-[180px]">
                    {projectName ?? "—"}
                  </span>
                )}
                <span aria-hidden className="text-[#404040]">
                  →
                </span>
                <span className="truncate text-[var(--text-primary)] max-w-[220px]">
                  {currentEpisodeTitle}
                </span>
              </div>

              {/* Mobile: só o episódio atual */}
              <div className="sm:hidden flex items-center text-[11px] text-[var(--text-muted)]">
                <span className="truncate max-w-[200px]">
                  {currentEpisodeTitle}
                </span>
              </div>
            </div>

            {projectStatus ? (
              <div className="shrink-0">
                <StatusPill
                  label={pill.label}
                  dot={pill.dot}
                  border={pill.border}
                  bg={pill.bg}
                  text={pill.text}
                />
              </div>
            ) : null}
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
        </div>

        {/* Zona central: progresso do projeto */}
        <div className="min-w-0">
          <div className="text-[12px] font-[600] text-[#e8e8e8]">
            Episódio {currentEpisodeNumber} de {total}
          </div>
          <div
            className="mt-2 h-[4px] overflow-hidden rounded-[2px] border"
            style={{
              borderColor: pill.border,
              background: hexToRgba(pill.border, 0.14),
            }}
          >
            <div
              className="h-full rounded-[2px] bg-[#1D9E75] transition-[width] duration-300"
              style={{ width: `${pct}%` }}
              aria-hidden
            />
          </div>
          <div className="mt-2 text-[11px] font-medium text-[#5DCAA5]">
            {pct}% concluído
          </div>
        </div>

        {/* Zona direita: ações + info do arquivo + estados */}
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            disabled={!canSaveAndComplete || saveCompleting}
            onClick={() => void onSaveAndComplete()}
            className="rounded-md border border-[#0F6E56] bg-[#1D9E75] px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm transition-colors hover:bg-[#0F6E56] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saveCompleting ? "A concluir…" : "Salvar e concluir"}
          </button>

          {showEditorToolbar ? (
            <>
              <div className="min-w-0 text-right">
                <p
                  className="truncate text-xs font-medium text-[var(--text-primary)]"
                  title={editorFilename ?? undefined}
                >
                  {editorFilename ?? "—"}
                </p>
                <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--text-muted)]">
                  {editorCuesCount ?? 0} cues
                  {editorWavFilename ? ` · ${editorWavFilename}` : ""}
                </p>
              </div>

              <div className="mvp-state-row mt-0">
                {editorLoading ? (
                  <span className="mvp-state-badge mvp-state-badge--loading">
                    carregando legenda
                  </span>
                ) : null}
                {editorSaving ? (
                  <span className="mvp-state-badge mvp-state-badge--loading">
                    salvando alteracoes
                  </span>
                ) : null}
                {editorExporting ? (
                  <span className="mvp-state-badge mvp-state-badge--loading">
                    exportando
                  </span>
                ) : null}
                {editorSaveSuccess ? (
                  <span className="mvp-state-badge mvp-state-badge--success">
                    {editorSaveSuccess}
                  </span>
                ) : null}
                {editorError ? (
                  <span className="mvp-state-badge mvp-state-badge--error">
                    erro na operacao
                  </span>
                ) : null}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
