"use client";

import { useRouter } from "next/navigation";
import type { DubbingEpisodeDto } from "@/app/types/dubbing-episode";
import type { DubbingProjectStatus } from "../../projetos/domain";

// ─── tipos ────────────────────────────────────────────────────────────────────

type DubbingEpisodeNavBarProps = {
  currentEpisodeId: string;
  episodes: DubbingEpisodeDto[];
  loading: boolean;
  error: string | null;
  onSelectDoneEpisode: (ep: DubbingEpisodeDto) => void;
  onSaveAndComplete: () => void;
  saveCompleting: boolean;
  canSaveAndComplete: boolean;
  showEditorToolbar?: boolean;
  editorFilename?: string | null;
  editorCuesCount?: number;
  editorWavFilename?: string | null;
  editorLoading?: boolean;
  editorSaving?: boolean;
  editorExporting?: boolean;
  editorSaveSuccess?: string | null;
  editorError?: string | null;
  projectId?: string;
  projectName?: string | null;
  projectStatus?: DubbingProjectStatus | null;
};

// ─── config de fase ───────────────────────────────────────────────────────────

const PHASE_CONFIG: Record<
  DubbingProjectStatus,
  { label: string; color: string; bg: string; border: string }
> = {
  SPOTTING: {
    label: "Spotting",
    color: "#8BB4E5",
    bg: "rgba(91,155,213,0.12)",
    border: "#5B9BD5",
  },
  ADAPTATION: {
    label: "Adaptação",
    color: "#E5A84A",
    bg: "rgba(186,117,23,0.12)",
    border: "#BA7517",
  },
  REVIEW: {
    label: "Revisão",
    color: "#C4B0FC",
    bg: "rgba(167,139,250,0.12)",
    border: "#A78BFA",
  },
  RECORDING: {
    label: "Em gravação",
    color: "#5DCAA5",
    bg: "rgba(29,158,117,0.12)",
    border: "#1D9E75",
  },
  DELIVERY: {
    label: "Entrega",
    color: "#FCD34D",
    bg: "rgba(251,191,36,0.12)",
    border: "#FBBF24",
  },
  DONE: {
    label: "Concluído",
    color: "#86EFAC",
    bg: "rgba(74,222,128,0.12)",
    border: "#4ade80",
  },
  PAUSED: {
    label: "Pausado",
    color: "#909090",
    bg: "rgba(85,85,85,0.18)",
    border: "#555555",
  },
};

const FALLBACK_PHASE = {
  label: "—",
  color: "#606060",
  bg: "rgba(96,96,96,0.15)",
  border: "#444444",
};

// ─── componente ───────────────────────────────────────────────────────────────

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

  const phase =
    (projectStatus ? PHASE_CONFIG[projectStatus] : null) ?? FALLBACK_PHASE;

  const total = episodes.length;
  const done = episodes.filter((e) => e.status === "DONE").length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  const currentEp = episodes.find((e) => e.id === currentEpisodeId);
  const currentNum = currentEp?.number ?? 0;
  const currentTitle = currentEp?.title?.trim() || `Episódio ${currentNum}`;

  // estados do editor que têm texto visível
  const editorStateLabel = editorLoading
    ? "carregando…"
    : editorSaving
      ? "salvando…"
      : editorExporting
        ? "exportando…"
        : editorSaveSuccess
          ? editorSaveSuccess
          : editorError
            ? "erro na operação"
            : null;

  const editorStateColor = editorError
    ? "#F09595"
    : editorSaveSuccess
      ? "#5DCAA5"
      : "#909090";

  return (
    <>
      {/* estilos encapsulados */}
      <style>{`
        .ep-nav-chip-current {
          background: var(--bg-mid, #252525);
          border: 1px solid var(--border-mid, #404040);
          color: #e8e8e8;
        }
        .ep-nav-chip-done {
          background: #0d3d2a55;
          border: 1px solid #0F6E5666;
          color: #5DCAA5;
        }
        .ep-nav-chip-done:hover {
          background: #0d3d2a99;
          border-color: #1D9E75;
        }
        .ep-nav-chip-locked {
          border: 1px dashed #2e2e2e;
          color: #404040;
        }
      `}</style>

      <div
        className="shrink-0 border-b border-[#1e1e1e] bg-[#111111]"
        data-testid="dubbing-episode-nav"
      >
        {/* linha principal */}
        <div className="flex min-h-[44px] items-center gap-[12px] px-[14px] py-[8px]">
          {/* ── Zona esquerda: breadcrumb + fase + chips ── */}
          <div className="flex min-w-0 flex-1 flex-col gap-[5px]">
            {/* breadcrumb */}
            <div className="flex items-center gap-[5px] text-[11px]">
              <button
                type="button"
                onClick={() => router.push("/projetos")}
                className="text-[#505050] transition-colors hover:text-[#909090]"
              >
                Projetos
              </button>
              <span className="text-[#2e2e2e]" aria-hidden>
                ›
              </span>

              {projectId ? (
                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      `/projetos/${encodeURIComponent(projectId)}?tab=episodios`,
                    )
                  }
                  className="max-w-[160px] truncate text-[#505050] transition-colors hover:text-[#909090]"
                  title={projectName ?? undefined}
                >
                  {projectName ?? "—"}
                </button>
              ) : (
                <span className="max-w-[160px] truncate text-[#505050]">
                  {projectName ?? "—"}
                </span>
              )}

              <span className="text-[#2e2e2e]" aria-hidden>
                ›
              </span>
              <span className="max-w-[180px] truncate text-[#909090]">
                {currentTitle}
              </span>

              {/* badge de fase */}
              {projectStatus ? (
                <span
                  className="ml-[4px] shrink-0 rounded-[4px] border px-[6px] py-[1px] text-[10px] font-[600]"
                  style={{
                    borderColor: phase.border,
                    background: phase.bg,
                    color: phase.color,
                  }}
                >
                  {phase.label}
                </span>
              ) : null}
            </div>

            {/* chips de episódio */}
            {loading ? (
              <span className="text-[10px] text-[#505050]">
                Carregando episódios…
              </span>
            ) : error ? (
              <span className="text-[10px] text-[#F09595]">{error}</span>
            ) : (
              <ul className="flex flex-wrap items-center gap-[4px]">
                {episodes.map((ep) => {
                  const isCurrent = ep.id === currentEpisodeId;
                  const hasFile = Boolean(ep.subtitleFileId);

                  if (isCurrent) {
                    return (
                      <li key={ep.id}>
                        <span
                          className="ep-nav-chip-current inline-flex items-center gap-[4px] rounded-[5px] px-[7px] py-[2px] font-mono text-[11px] font-[600]"
                          title={`Episódio atual · #${ep.number}`}
                        >
                          <span aria-hidden className="text-[#1D9E75]">
                            ●
                          </span>
                          #{ep.number}
                        </span>
                      </li>
                    );
                  }

                  if (hasFile) {
                    return (
                      <li key={ep.id}>
                        <button
                          type="button"
                          onClick={() => onSelectDoneEpisode(ep)}
                          className="ep-nav-chip-done inline-flex items-center gap-[4px] rounded-[5px] px-[7px] py-[2px] font-mono text-[11px] transition-colors"
                          title={`Abrir episódio #${ep.number}`}
                        >
                          <span aria-hidden className="text-[#1D9E75]">
                            ✓
                          </span>
                          #{ep.number}
                        </button>
                      </li>
                    );
                  }

                  return (
                    <li key={ep.id}>
                      <span
                        className="ep-nav-chip-locked inline-flex cursor-not-allowed items-center gap-[4px] rounded-[5px] px-[7px] py-[2px] font-mono text-[11px] opacity-50"
                        title={`Episódio #${ep.number} — sem legenda`}
                      >
                        <span aria-hidden>○</span>#{ep.number}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* ── Zona central: progresso ── */}
          <div className="hidden w-[220px] shrink-0 flex-col gap-[4px] sm:flex">
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] font-[600] text-[#e8e8e8]">
                Episódio {currentNum} de {total}
              </span>
              <span className="text-[11px] font-[500] text-[#5DCAA5]">
                {pct}%
              </span>
            </div>
            <div
              className="h-[4px] overflow-hidden rounded-full border"
              style={{
                borderColor: phase.border,
                background: `rgba(${hexToRgb(phase.border)},0.14)`,
              }}
            >
              <div
                className="h-full rounded-full bg-[#1D9E75] transition-[width] duration-300"
                style={{ width: `${pct}%` }}
                aria-hidden
              />
            </div>
            <span className="text-[10px] text-[#505050]">concluído</span>
          </div>

          {/* ── Zona direita: ação + info do arquivo ── */}
          <div className="flex shrink-0 flex-col items-end gap-[4px]">
            <button
              type="button"
              disabled={!canSaveAndComplete || saveCompleting}
              onClick={() => void onSaveAndComplete()}
              className="rounded-[6px] border border-[#0F6E56] bg-[#1D9E75] px-[12px] py-[6px] text-[11px] font-[600] text-white shadow-sm transition-colors hover:bg-[#0F6E56] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {saveCompleting ? "A concluir…" : "Salvar e concluir"}
            </button>

            {showEditorToolbar ? (
              <div className="flex items-center gap-[8px] text-right">
                <div className="min-w-0">
                  <p
                    className="truncate text-[11px] font-[500] text-[#909090]"
                    title={editorFilename ?? undefined}
                    style={{ maxWidth: 140 }}
                  >
                    {editorFilename ?? "—"}
                  </p>
                  <p className="font-mono text-[10px] text-[#505050]">
                    {editorCuesCount ?? 0} cues
                    {editorWavFilename ? ` · ${editorWavFilename}` : ""}
                  </p>
                </div>
              </div>
            ) : null}

            {/* estado do editor */}
            {editorStateLabel ? (
              <span
                className="text-[10px] font-[500]"
                style={{ color: editorStateColor }}
              >
                {editorStateLabel}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

// ─── utilidade ────────────────────────────────────────────────────────────────

function hexToRgb(hex: string): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return "96,96,96";
  return `${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)}`;
}
