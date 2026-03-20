"use client";

import type { Episode, EpisodeStatus, Project } from "@/src/types/project";

type EpisodeQueueScreenProps = {
  project: Project;
  onOpenEpisode: (episodeId: string) => void;
  onDownloadEpisode: (episodeId: string) => void;
  onBackToUpload: () => void;
};

const STATUS_META: Record<
  EpisodeStatus,
  { label: string; color: string; bg: string }
> = {
  pending: {
    label: "○ Pendente",
    color: "text-white/35",
    bg: "bg-transparent",
  },
  in_progress: {
    label: "→ Editando",
    color: "text-sky-300",
    bg: "bg-sky-500/10",
  },
  done: {
    label: "✓ Concluído",
    color: "text-emerald-300",
    bg: "bg-emerald-500/10",
  },
  missing_audio: {
    label: "⚠ Sem áudio",
    color: "text-amber-300",
    bg: "bg-amber-500/10",
  },
  missing_srt: {
    label: "⚠ Sem SRT",
    color: "text-red-300",
    bg: "bg-red-500/10",
  },
};

function hasOpenAction(ep: Episode): boolean {
  return ep.srtFile != null;
}

export function EpisodeQueueScreen({
  project,
  onOpenEpisode,
  onDownloadEpisode,
  onBackToUpload,
}: EpisodeQueueScreenProps) {
  const doneCount = project.episodes.filter((ep) => ep.status === "done").length;
  const totalCount = project.episodes.length;
  const donePct = totalCount > 0 ? (doneCount / totalCount) * 100 : 0;

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden bg-zinc-950">
      <div className="flex items-center gap-3 border-b border-zinc-800/90 px-4 py-2">
        <button
          type="button"
          className="rounded border border-zinc-700 px-2 py-1 text-[11px] text-zinc-300 hover:border-zinc-500 hover:text-zinc-100"
          onClick={onBackToUpload}
        >
          ← Trocar pasta
        </button>
        <strong className="truncate text-sm text-zinc-100">{project.name}</strong>
        <span className="text-xs text-zinc-400">
          {doneCount}/{totalCount} concluídos
        </span>
      </div>
      <div className="h-0.5 w-full bg-white/10">
        <div
          className="h-full bg-emerald-400 transition-[width] duration-300 ease-out"
          style={{ width: `${donePct}%` }}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="sticky top-0 z-10 bg-zinc-900/95">
            <tr className="border-b border-zinc-700/70 text-[10px] uppercase tracking-[0.08em] text-zinc-500">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Episódio</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Legendas</th>
              <th className="px-3 py-2 text-right">Ação</th>
            </tr>
          </thead>
          <tbody>
            {project.episodes.map((ep, index) => {
              const meta = STATUS_META[ep.status];
              return (
                <tr
                  key={ep.id}
                  className={`border-b border-white/5 ${meta.bg} ${
                    hasOpenAction(ep) ? "cursor-pointer hover:bg-white/5" : ""
                  }`}
                  onClick={() => {
                    if (hasOpenAction(ep)) onOpenEpisode(ep.id);
                  }}
                >
                  <td className="px-3 py-2 text-zinc-400">{index + 1}</td>
                  <td className="px-3 py-2 font-medium text-zinc-100">{ep.name}</td>
                  <td className={`px-3 py-2 ${meta.color}`}>{meta.label}</td>
                  <td className="px-3 py-2 text-zinc-400">
                    {ep.editedCues ? `${ep.editedCues.length} cues` : "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {ep.status === "done" ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDownloadEpisode(ep.id);
                        }}
                        className="rounded border border-zinc-600 px-2 py-1 text-[11px] text-zinc-300 hover:border-zinc-400 hover:text-zinc-100"
                      >
                        ↓ Baixar
                      </button>
                    ) : hasOpenAction(ep) ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenEpisode(ep.id);
                        }}
                        className="rounded bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-500"
                      >
                        {ep.status === "in_progress" ? "Continuar →" : "Abrir →"}
                      </button>
                    ) : (
                      <span className="text-[11px] text-zinc-600">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
