"use client";

import { useEffect, useState } from "react";

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

export default function SubtitleFileViewPage() {
  const [subtitleFileId, setSubtitleFileId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<SubtitleFileResponse | null>(null);

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

      {data ? (
        <section className="mt-6 max-w-4xl space-y-3">
          <div>
            <p className="font-medium">filename</p>
            <p className="font-mono text-sm">{data.filename}</p>
          </div>

          <div>
            <p className="font-medium">subtitleFileId</p>
            <p className="font-mono text-sm">{data.subtitleFileId}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              className="rounded border px-3 py-1 text-sm hover:bg-zinc-50"
              href={`/subtitle-file-edit?subtitleFileId=${encodeURIComponent(data.subtitleFileId)}`}
            >
              Abrir no editor
            </a>
          </div>

          <div>
            <p className="font-medium">projectId</p>
            <p className="font-mono text-sm">{data.projectId}</p>
          </div>

          <div>
            <p className="font-medium">cues ({data.cues.length})</p>
            <div className="mt-2 space-y-2">
              {data.cues.map((cue) => (
                <div key={cue.id} className="rounded border bg-white p-3">
                  <p className="font-mono text-sm">
                    #{cue.cueIndex} | {cue.startMs}ms - {cue.endMs}ms
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{cue.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}

