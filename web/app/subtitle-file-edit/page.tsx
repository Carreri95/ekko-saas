"use client";

import { useEffect, useMemo, useState } from "react";

type CueDto = {
  id: string | null;
  tempId: string;
  cueIndex: number;
  startMs: number;
  endMs: number;
  text: string;
};

type SubtitleFileResponse = {
  subtitleFileId: string;
  filename: string;
  projectId: string;
  cues: CueDto[];
};

type SaveResponse = {
  subtitleFileId: string;
  updatedCount: number;
  versionId: string;
  versionNumber: number;
  versionCreatedAt: string;
  cues: Array<{
    id: string;
    cueIndex: number;
    startMs: number;
    endMs: number;
    text: string;
  }>;
};

type VersionItem = {
  id: string;
  versionNumber: number;
  createdAt: string;
};

type VersionsResponse = {
  subtitleFileId: string;
  versions: VersionItem[];
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

function getCueProblems(cues: CueDto[], index: number): string[] {
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

function createTempId(): string {
  return `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function reindexCues(cues: CueDto[]): CueDto[] {
  return cues.map((cue, index) => ({ ...cue, cueIndex: index + 1 }));
}

export default function SubtitleFileEditPage() {
  const [subtitleFileId, setSubtitleFileId] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [cues, setCues] = useState<CueDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveResponse, setSaveResponse] = useState<SaveResponse | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [filterMode, setFilterMode] = useState<ProblemFilter>("all");

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("subtitleFileId");
    if (id) setSubtitleFileId(id);
  }, []);

  const hasInvalidCue = useMemo(
    () =>
      cues.some(
        (cue) =>
          !Number.isFinite(cue.startMs) ||
          !Number.isFinite(cue.endMs) ||
          cue.startMs >= cue.endMs
      ),
    [cues]
  );

  const cueProblemsList = useMemo(
    () =>
      cues.map((cue, index) => ({
        cue,
        problems: getCueProblems(cues, index),
      })),
    [cues]
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

  async function handleLoad() {
    const id = subtitleFileId.trim();
    if (!id) {
      setError("Informe um subtitleFileId");
      return;
    }

    setLoading(true);
    setError(null);
    setSaveSuccess(null);
    setExportSuccess(null);
    setSaveResponse(null);

    try {
      const res = await fetch(`/api/subtitle-files/${encodeURIComponent(id)}`);
      const json = await res.json();

      if (!res.ok) {
        const message =
          json && typeof json === "object" && "error" in json
            ? String((json as { error: unknown }).error)
            : "Falha ao carregar SubtitleFile";
        setError(`Erro ${res.status}: ${message}`);
        setFilename(null);
        setCues([]);
        setVersions([]);
        return;
      }

      const data = json as SubtitleFileResponse;
      setFilename(data.filename);
      setCues(
        data.cues.map((cue) => ({
          ...cue,
          id: cue.id,
          tempId: cue.id,
        }))
      );
      void loadVersions(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setFilename(null);
      setCues([]);
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadVersions(id: string) {
    setVersionsLoading(true);
    try {
      const res = await fetch(`/api/subtitle-files/${encodeURIComponent(id)}/versions`);
      const json = await res.json();
      if (!res.ok) {
        setVersions([]);
        return;
      }
      const data = json as VersionsResponse;
      setVersions(data.versions);
    } catch {
      setVersions([]);
    } finally {
      setVersionsLoading(false);
    }
  }

  function updateCue(
    cueTempId: string,
    patch: Partial<Pick<CueDto, "startMs" | "endMs" | "text">>
  ) {
    setCues((prev) => prev.map((cue) => (cue.tempId === cueTempId ? { ...cue, ...patch } : cue)));
  }

  function duplicateCue(cueTempId: string) {
    setCues((prev) => {
      const index = prev.findIndex((cue) => cue.tempId === cueTempId);
      if (index < 0) return prev;
      const source = prev[index];
      const duplicated: CueDto = {
        ...source,
        id: null,
        tempId: createTempId(),
      };
      const next = [...prev];
      next.splice(index + 1, 0, duplicated);
      return reindexCues(next);
    });
  }

  function removeCue(cueTempId: string) {
    setCues((prev) => {
      const next = prev.filter((cue) => cue.tempId !== cueTempId);
      return reindexCues(next);
    });
  }

  async function handleSave() {
    const id = subtitleFileId.trim();
    if (!id) {
      setError("Informe um subtitleFileId");
      return;
    }

    for (const cue of cues) {
      if (!Number.isFinite(cue.startMs) || !Number.isFinite(cue.endMs)) {
        setError(`Cue ${cue.cueIndex}: startMs/endMs inválidos`);
        return;
      }

      if (cue.startMs >= cue.endMs) {
        setError(`Cue ${cue.cueIndex}: startMs deve ser menor que endMs`);
        return;
      }
    }

    setSaving(true);
    setError(null);
    setSaveSuccess(null);
    setSaveResponse(null);

    try {
      const res = await fetch("/api/subtitle-cues/bulk-update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subtitleFileId: id,
          cues: cues.map((cue) => ({
            id: cue.id ?? undefined,
            startMs: cue.startMs,
            endMs: cue.endMs,
            text: cue.text,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        const message =
          json && typeof json === "object" && "error" in json
            ? String((json as { error: unknown }).error)
            : "Falha ao salvar";
        setError(`Erro ${res.status}: ${message}`);
        return;
      }

      const response = json as SaveResponse;
      setSaveResponse(response);
      setCues(
        response.cues.map((cue) => ({
          ...cue,
          id: cue.id,
          tempId: cue.id,
        }))
      );
      setSaveSuccess("Alterações salvas com sucesso.");
      void loadVersions(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    const id = subtitleFileId.trim();
    if (!id || !filename) return;
    window.open(`/api/subtitle-files/${encodeURIComponent(id)}/export`, "_blank");
    setExportSuccess("Exportação iniciada. Verifique o download do navegador.");
  }

  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-semibold">Editar SubtitleFile</h1>
      <nav className="mt-3 flex flex-wrap gap-2 text-sm">
        <a className="rounded border px-3 py-1 hover:bg-zinc-50" href="/srt-upload-test">
          Upload SRT Test
        </a>
        <a className="rounded border px-3 py-1 hover:bg-zinc-50" href="/subtitle-file-view">
          Visualizar Cues
        </a>
      </nav>

      <section className="mt-4 max-w-4xl rounded border border-dashed bg-zinc-50 p-4">
        <p className="text-sm font-semibold">Área reservada para player (MVP 3)</p>
        <p className="mt-1 text-sm text-zinc-600">
          Este espaço será usado para acoplar player de mídia e sincronização de cues no futuro.
        </p>
        <div className="mt-3 flex h-44 items-center justify-center rounded border border-dashed bg-white text-sm text-zinc-500">
          Placeholder do player
        </div>
      </section>

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
          onClick={handleLoad}
          disabled={loading}
        >
          {loading ? "Carregando..." : "Carregar cues"}
        </button>
      </div>

      {filename ? (
        <section className="mt-3 max-w-3xl rounded border bg-white p-3">
          <p className="text-sm font-semibold">Ações rápidas</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="font-mono text-sm">
              <span className="font-semibold">filename:</span> {filename}
            </p>
            <button
              type="button"
              className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-60"
              onClick={handleExport}
              disabled={!subtitleFileId.trim() || !filename}
            >
              Exportar SRT
            </button>
          </div>
        </section>
      ) : null}

      {cues.length > 0 ? (
        <div className="mt-3 max-w-3xl rounded border bg-zinc-50 p-3 text-sm">
          <p>
            <span className="font-medium">Resumo:</span>{" "}
            <span className="font-mono">total={cues.length}</span>{" "}
            <span className="font-mono">problemáticas={problematicCount}</span>{" "}
            <span className="font-mono">filtro={filterLabel}</span>
          </p>
        </div>
      ) : null}

      {error ? (
        <pre className="mt-4 whitespace-pre-wrap rounded border border-red-200 bg-red-50 p-3 font-mono text-sm text-red-800">
          {error}
        </pre>
      ) : null}

      {saveSuccess ? (
        <pre className="mt-4 whitespace-pre-wrap rounded border border-green-200 bg-green-50 p-3 font-mono text-sm text-green-800">
          {saveSuccess}
        </pre>
      ) : null}

      {exportSuccess ? (
        <pre className="mt-4 whitespace-pre-wrap rounded border border-blue-200 bg-blue-50 p-3 font-mono text-sm text-blue-800">
          {exportSuccess}
        </pre>
      ) : null}

      {cues.length > 0 && hasInvalidCue ? (
        <pre className="mt-4 whitespace-pre-wrap rounded border border-amber-200 bg-amber-50 p-3 font-mono text-sm text-amber-900">
          Há cues inválidos. Corrija antes de salvar (startMs deve ser menor que endMs).
        </pre>
      ) : null}

      {cues.length > 0 ? (
        <section className="mt-6 max-w-4xl space-y-3">
          <div className="rounded border bg-zinc-50 p-3">
            <p className="text-sm font-medium">
              Cues problemáticas:{" "}
              <span className="font-mono">
                {problematicCount} / {cues.length}
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

          {visibleCueProblemsList.map(({ cue, problems }) => {
            const hasProblems = problems.length > 0;

            return (
            <div
              key={cue.tempId}
              className={`rounded border p-3 ${
                hasProblems
                  ? "border-amber-400 bg-amber-50"
                  : "border-zinc-200 bg-white"
              }`}
            >
              <p className="font-mono text-sm">cueIndex: {cue.cueIndex}</p>
              {hasProblems ? (
                <p className="mt-1 text-xs font-medium text-amber-900">
                  Problemas: {problems.join(" | ")}
                </p>
              ) : null}

              <div className="mt-2 grid gap-2 md:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-sm font-medium">startMs</span>
                  <input
                    type="number"
                    className="w-full rounded border p-2"
                    value={cue.startMs}
                    onChange={(e) => {
                      const parsed = Number.parseInt(e.target.value, 10);
                      if (!Number.isFinite(parsed)) return;
                      updateCue(cue.tempId, { startMs: parsed });
                    }}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-medium">endMs</span>
                  <input
                    type="number"
                    className="w-full rounded border p-2"
                    value={cue.endMs}
                    onChange={(e) => {
                      const parsed = Number.parseInt(e.target.value, 10);
                      if (!Number.isFinite(parsed)) return;
                      updateCue(cue.tempId, { endMs: parsed });
                    }}
                  />
                </label>
              </div>

              <label className="mt-2 block">
                <span className="mb-1 block text-sm font-medium">text</span>
                <textarea
                  className="min-h-[90px] w-full rounded border p-2"
                  value={cue.text}
                  onChange={(e) => updateCue(cue.tempId, { text: e.target.value })}
                />
              </label>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  className="rounded border px-3 py-1 text-sm hover:bg-zinc-50"
                  onClick={() => duplicateCue(cue.tempId)}
                >
                  Duplicar cue
                </button>
                <button
                  type="button"
                  className="rounded border px-3 py-1 text-sm hover:bg-zinc-50"
                  onClick={() => removeCue(cue.tempId)}
                  disabled={cues.length <= 1}
                >
                  Remover cue
                </button>
              </div>
            </div>
            );
          })}

          <button
            type="button"
            className="rounded bg-black px-4 py-2 text-white disabled:opacity-60"
            onClick={handleSave}
            disabled={saving || hasInvalidCue}
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </section>
      ) : null}

      {saveResponse ? (
        <section className="mt-4 max-w-3xl rounded border bg-white p-3">
          <p className="text-sm font-semibold">Retorno do último salvamento</p>
          <div className="mt-2 space-y-1 font-mono text-sm">
            <p>
              <span className="font-semibold">updatedCount:</span> {saveResponse.updatedCount}
            </p>
            <p>
              <span className="font-semibold">versionId:</span> {saveResponse.versionId}
            </p>
            <p>
              <span className="font-semibold">versionNumber:</span> {saveResponse.versionNumber}
            </p>
            <p>
              <span className="font-semibold">versionCreatedAt:</span> {saveResponse.versionCreatedAt}
            </p>
          </div>
        </section>
      ) : null}

      {subtitleFileId.trim() ? (
        <section className="mt-4 max-w-3xl rounded border bg-white p-3">
          <p className="text-sm font-semibold">Histórico de versões</p>
          {versionsLoading ? (
            <p className="mt-2 text-sm text-zinc-600">Carregando versões...</p>
          ) : versions.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-600">Nenhuma versão registrada ainda.</p>
          ) : (
            <div className="mt-2 space-y-1 font-mono text-sm">
              {versions.map((version) => (
                <p key={version.id}>
                  v{version.versionNumber} | {version.createdAt} | {version.id}
                </p>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}

