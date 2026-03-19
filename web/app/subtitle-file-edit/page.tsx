"use client";

import { useEffect, useMemo, useState } from "react";

type CueDto = {
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
  cues: CueDto[];
};

export default function SubtitleFileEditPage() {
  const [subtitleFileId, setSubtitleFileId] = useState("");
  const [filename, setFilename] = useState<string | null>(null);
  const [cues, setCues] = useState<CueDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveResponse, setSaveResponse] = useState<unknown>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

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

  async function handleLoad() {
    const id = subtitleFileId.trim();
    if (!id) {
      setError("Informe um subtitleFileId");
      return;
    }

    setLoading(true);
    setError(null);
    setSaveSuccess(null);
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
        return;
      }

      const data = json as SubtitleFileResponse;
      setFilename(data.filename);
      setCues(data.cues);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setFilename(null);
      setCues([]);
    } finally {
      setLoading(false);
    }
  }

  function updateCue(
    cueId: string,
    patch: Partial<Pick<CueDto, "startMs" | "endMs" | "text">>
  ) {
    setCues((prev) => prev.map((cue) => (cue.id === cueId ? { ...cue, ...patch } : cue)));
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
            id: cue.id,
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

      setSaveResponse(json);
      setSaveSuccess("Alterações salvas com sucesso.");
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
        <div className="mt-3 flex max-w-3xl items-center gap-3">
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

      {cues.length > 0 && hasInvalidCue ? (
        <pre className="mt-4 whitespace-pre-wrap rounded border border-amber-200 bg-amber-50 p-3 font-mono text-sm text-amber-900">
          Há cues inválidos. Corrija antes de salvar (startMs deve ser menor que endMs).
        </pre>
      ) : null}

      {cues.length > 0 ? (
        <section className="mt-6 max-w-4xl space-y-3">
          {cues.map((cue) => (
            <div key={cue.id} className="rounded border bg-white p-3">
              <p className="font-mono text-sm">cueIndex: {cue.cueIndex}</p>

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
                      updateCue(cue.id, { startMs: parsed });
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
                      updateCue(cue.id, { endMs: parsed });
                    }}
                  />
                </label>
              </div>

              <label className="mt-2 block">
                <span className="mb-1 block text-sm font-medium">text</span>
                <textarea
                  className="min-h-[90px] w-full rounded border p-2"
                  value={cue.text}
                  onChange={(e) => updateCue(cue.id, { text: e.target.value })}
                />
              </label>
            </div>
          ))}

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
        <pre className="mt-4 max-w-3xl whitespace-pre-wrap rounded border bg-white p-3 font-mono text-sm">
          {JSON.stringify(saveResponse, null, 2)}
        </pre>
      ) : null}
    </main>
  );
}

