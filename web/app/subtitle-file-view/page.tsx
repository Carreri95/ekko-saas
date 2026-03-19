"use client";

import { useEffect, useMemo, useState } from "react";

type SubtitleCueDto = {
  id: string;
  cueIndex: number;
  startMs: number;
  endMs: number;
  text: string;
};

type SubtitleFileResponse = {
  subtitleFileId: string;
  filename: string;
  projectId: string;
  cues: SubtitleCueDto[];
};

type ProblemFilter =
  | "all"
  | "problematic"
  | "invalid-time"
  | "empty-text"
  | "overlap"
  | "short-duration"
  | "long-duration";

const MIN_DURATION_MS = 400;
const MAX_DURATION_MS = 12000;

function getCueProblems(cues: SubtitleCueDto[], index: number): string[] {
  const cue = cues[index];
  const nextCue = cues[index + 1];
  const problems: string[] = [];

  if (cue.startMs >= cue.endMs) {
    problems.push("startMs >= endMs");
  }

  if (!cue.text.trim()) {
    problems.push("texto vazio");
  }

  if (nextCue && cue.endMs > nextCue.startMs) {
    problems.push(`overlap com próxima cue (#${nextCue.cueIndex})`);
  }

  const duration = cue.endMs - cue.startMs;
  if (duration < MIN_DURATION_MS) {
    problems.push(`duração curta (${duration}ms)`);
  } else if (duration > MAX_DURATION_MS) {
    problems.push(`duração longa (${duration}ms)`);
  }

  return problems;
}

export default function SubtitleFileViewPage() {
  const [subtitleFileId, setSubtitleFileId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SubtitleFileResponse | null>(null);
  const [filterMode, setFilterMode] = useState<ProblemFilter>("all");
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("subtitleFileId");
    if (id) setSubtitleFileId(id);
  }, []);

  async function handleSearch() {
    const id = subtitleFileId.trim();
    if (!id) {
      setError("Informe um subtitleFileId");
      setData(null);
      return;
    }

    setLoading(true);
    setError(null);
    setExportSuccess(null);
    setData(null);

    try {
      const res = await fetch(`/api/subtitle-files/${encodeURIComponent(id)}`);
      const json = await res.json();

      if (!res.ok) {
        const message =
          json && typeof json === "object" && "error" in json
            ? String((json as { error: unknown }).error)
            : "Falha ao buscar SubtitleFile";
        setError(`Erro ${res.status}: ${message}`);
        return;
      }

      setData(json as SubtitleFileResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const cueProblemsList = useMemo(
    () =>
      (data?.cues ?? []).map((cue, index) => ({
        cue,
        problems: getCueProblems(data?.cues ?? [], index),
      })),
    [data]
  );

  const problematicCount = useMemo(
    () => cueProblemsList.filter((item) => item.problems.length > 0).length,
    [cueProblemsList]
  );

  const visibleCueProblemsList = useMemo(
    () =>
      filterMode === "all"
        ? cueProblemsList
        : cueProblemsList.filter((item) => {
            if (filterMode === "problematic") {
              return item.problems.length > 0;
            }
            if (filterMode === "invalid-time") {
              return item.problems.some((problem) => problem.startsWith("startMs >="));
            }
            if (filterMode === "empty-text") {
              return item.problems.some((problem) => problem === "texto vazio");
            }
            if (filterMode === "overlap") {
              return item.problems.some((problem) => problem.startsWith("overlap"));
            }
            if (filterMode === "short-duration") {
              return item.problems.some((problem) => problem.startsWith("duração curta"));
            }
            if (filterMode === "long-duration") {
              return item.problems.some((problem) => problem.startsWith("duração longa"));
            }
            return false;
          }),
    [cueProblemsList, filterMode]
  );

  const filterLabel = useMemo(() => {
    if (filterMode === "all") return "todas";
    if (filterMode === "problematic") return "somente problemáticas";
    if (filterMode === "invalid-time") return "tempo inválido";
    if (filterMode === "empty-text") return "texto vazio";
    if (filterMode === "overlap") return "overlap";
    if (filterMode === "short-duration") return "duração curta";
    return "duração longa";
  }, [filterMode]);

  function handleExport() {
    if (!data?.subtitleFileId) return;
    window.open(`/api/subtitle-files/${encodeURIComponent(data.subtitleFileId)}/export`, "_blank");
    setExportSuccess("Exportação iniciada. Verifique o download do navegador.");
  }

  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-semibold">Visualizar SubtitleFile</h1>
      <nav className="mt-3 flex flex-wrap gap-2 text-sm">
        <a className="rounded border px-3 py-1 hover:bg-zinc-50" href="/srt-upload-test">
          Upload SRT Test
        </a>
        <a className="rounded border px-3 py-1 hover:bg-zinc-50" href="/subtitle-file-edit">
          Editar Cues
        </a>
      </nav>

      <div className="mt-4 flex max-w-3xl gap-2">
        <input
          className="flex-1 rounded border p-2"
          placeholder="Cole o subtitleFileId"
          value={subtitleFileId}
          onChange={(e) => setSubtitleFileId(e.target.value)}
        />
        <button
          type="button"
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-60"
          onClick={handleSearch}
          disabled={loading}
        >
          {loading ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {error ? (
        <pre className="mt-4 whitespace-pre-wrap rounded border border-red-200 bg-red-50 p-3 font-mono text-sm text-red-800">
          {error}
        </pre>
      ) : null}

      {exportSuccess ? (
        <pre className="mt-4 whitespace-pre-wrap rounded border border-blue-200 bg-blue-50 p-3 font-mono text-sm text-blue-800">
          {exportSuccess}
        </pre>
      ) : null}

      {data ? (
        <section className="mt-6 max-w-4xl space-y-3">
          <section className="rounded border bg-white p-3">
            <p className="text-sm font-semibold">Resumo do arquivo</p>
            <div className="mt-2 space-y-1">
              <p className="font-mono text-sm">
                <span className="font-semibold">filename:</span> {data.filename}
              </p>
              <p className="font-mono text-sm">
                <span className="font-semibold">subtitleFileId:</span> {data.subtitleFileId}
              </p>
              <p className="font-mono text-sm">
                <span className="font-semibold">projectId:</span> {data.projectId}
              </p>
            </div>
          </section>

          <section className="rounded border bg-white p-3">
            <p className="text-sm font-semibold">Ações rápidas</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <a
                className="rounded border px-3 py-1 text-sm hover:bg-zinc-50"
                href={`/subtitle-file-edit?subtitleFileId=${encodeURIComponent(data.subtitleFileId)}`}
              >
                Abrir no editor
              </a>
              <button
                type="button"
                className="rounded border px-3 py-1 text-sm hover:bg-zinc-50"
                onClick={handleExport}
              >
                Exportar SRT
              </button>
            </div>
          </section>

          <div className="max-w-3xl rounded border bg-zinc-50 p-3 text-sm">
            <p>
              <span className="font-medium">Resumo:</span>{" "}
              <span className="font-mono">total={data.cues.length}</span>{" "}
              <span className="font-mono">problemáticas={problematicCount}</span>{" "}
              <span className="font-mono">filtro={filterLabel}</span>
            </p>
          </div>

          <section>
            <p className="font-medium">cues ({data.cues.length})</p>
            <div className="mt-2 rounded border bg-zinc-50 p-3">
              <p className="text-sm font-medium">
                Cues problemáticas:{" "}
                <span className="font-mono">
                  {problematicCount} / {data.cues.length}
                </span>
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className={`rounded border px-3 py-1 text-sm ${
                    filterMode === "all" ? "bg-black text-white" : "bg-white"
                  }`}
                  onClick={() => setFilterMode("all")}
                >
                  todas
                </button>
                <button
                  type="button"
                  className={`rounded border px-3 py-1 text-sm ${
                    filterMode === "problematic" ? "bg-black text-white" : "bg-white"
                  }`}
                  onClick={() => setFilterMode("problematic")}
                >
                  somente problemáticas
                </button>
              </div>
              <div className="mt-2">
                <label className="text-sm">
                  <span className="mr-2 font-medium">Tipo de problema:</span>
                  <select
                    className="rounded border bg-white px-2 py-1 text-sm"
                    value={filterMode}
                    onChange={(e) => setFilterMode(e.target.value as ProblemFilter)}
                  >
                    <option value="all">todas</option>
                    <option value="problematic">somente problemáticas</option>
                    <option value="invalid-time">tempo inválido</option>
                    <option value="empty-text">texto vazio</option>
                    <option value="overlap">overlap</option>
                    <option value="short-duration">duração curta</option>
                    <option value="long-duration">duração longa</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="mt-2 space-y-2">
              {visibleCueProblemsList.map(({ cue, problems }) => {
                const hasProblems = problems.length > 0;

                return (
                <div
                  key={cue.id}
                  className={`rounded border p-3 ${
                    hasProblems
                      ? "border-amber-400 bg-amber-50"
                      : "border-zinc-200 bg-white"
                  }`}
                >
                  <p className="font-mono text-sm">
                    #{cue.cueIndex} | {cue.startMs}ms - {cue.endMs}ms
                  </p>
                  {hasProblems ? (
                    <p className="mt-1 text-xs font-medium text-amber-900">
                      Problemas: {problems.join(" | ")}
                    </p>
                  ) : null}
                  <p className="mt-1 whitespace-pre-wrap">{cue.text}</p>
                </div>
                );
              })}
            </div>
          </section>
        </section>
      ) : null}
    </main>
  );
}

