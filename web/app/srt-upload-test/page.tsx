"use client";

import { useEffect, useState } from "react";

type ProjectDemoResponse = {
  projectId: string;
  projectName: string;
};

type UploadSrtResponse = {
  subtitleFileId: string;
  cuesCount: number;
  filename: string;
};

const DEFAULT_SRT = `1
00:00:01,000 --> 00:00:03,000
Olá, tudo bem?

2
00:00:04,000 --> 00:00:06,500
Vamos começar.`;

export default function SrtUploadTestPage() {
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectError, setProjectError] = useState<string | null>(null);

  const [filename, setFilename] = useState("demo.srt");
  const [srtContent, setSrtContent] = useState(DEFAULT_SRT);

  const [loading, setLoading] = useState(false);
  const [responseJson, setResponseJson] = useState<UploadSrtResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  async function handleFileSelect(file: File | null) {
    if (!file) return;

    setSubmitError(null);
    setSubmitSuccess(null);
    setResponseJson(null);

    const isSrt = file.name.toLowerCase().endsWith(".srt");
    if (!isSrt) {
      setSubmitError("Selecione um arquivo .srt válido.");
      return;
    }

    try {
      const content = await file.text();
      setFilename(file.name);
      setSrtContent(content);
      setSubmitError(null);
      setSubmitSuccess(`Arquivo "${file.name}" carregado no formulário.`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadDemoProject() {
      try {
        const res = await fetch("/api/projects/demo");
        const data = (await res.json()) as ProjectDemoResponse | { error: string };

        if (!res.ok) {
          const message = "error" in data ? data.error : "Falha ao obter project demo";
          if (!cancelled) setProjectError(message);
          return;
        }

        if (!cancelled) {
          setProjectId(data.projectId);
          setProjectError(null);
        }
      } catch (e) {
        if (!cancelled) {
          setProjectError(e instanceof Error ? e.message : String(e));
        }
      }
    }

    loadDemoProject();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit() {
    if (!projectId) {
      setSubmitError("Project demo não disponível.");
      return;
    }
    if (!filename.trim() || !srtContent.trim()) {
      setSubmitError("Preencha filename e srtContent antes de enviar.");
      return;
    }

    setLoading(true);
    setSubmitError(null);
    setSubmitSuccess(null);
    setResponseJson(null);

    try {
      const res = await fetch("/api/upload-srt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId,
          filename,
          srtContent,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        const message =
          data && typeof data === "object" && "error" in data
            ? String((data as { error: unknown }).error)
            : "Falha ao enviar SRT";
        setSubmitError(`Erro ${res.status}: ${message}`);
        return;
      }

      const payload = data as UploadSrtResponse;
      setResponseJson(payload);
      setSubmitSuccess(`SRT salvo com sucesso. Cues persistidos: ${payload.cuesCount}.`);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-semibold">Teste de Upload SRT (JSON)</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Fluxo MVP: criar projeto demo, enviar SRT, persistir cues e abrir visualização/edição.
      </p>

      <nav className="mt-3 flex flex-wrap gap-2 text-sm">
        <a className="rounded border px-3 py-1 hover:bg-zinc-50" href="/project-create-demo">
          Project Demo
        </a>
        <a className="rounded border px-3 py-1 hover:bg-zinc-50" href="/srt-parser-test">
          Parser Test
        </a>
        <a className="rounded border px-3 py-1 hover:bg-zinc-50" href="/subtitle-file-view">
          Visualizar Cues
        </a>
        <a className="rounded border px-3 py-1 hover:bg-zinc-50" href="/subtitle-file-edit">
          Editar Cues
        </a>
      </nav>

      <div className="mt-4 space-y-1">
        <p className="font-medium">Project Demo</p>
        {projectError ? (
          <p className="text-red-700">{projectError}</p>
        ) : (
          <p className="font-mono text-sm">{projectId ?? "carregando..."}</p>
        )}
      </div>

      <div className="mt-6 space-y-4">
        <div className="space-y-1">
          <label className="block font-medium" htmlFor="srtFile">
            arquivo .srt
          </label>
          <input
            id="srtFile"
            type="file"
            accept=".srt,text/plain,application/x-subrip"
            className="block w-full max-w-md rounded border bg-white p-2 text-sm"
            onChange={(e) => {
              const file = e.currentTarget.files?.[0] ?? null;
              void handleFileSelect(file);
            }}
          />
          <p className="text-xs text-zinc-500">
            Ao selecionar um arquivo, o nome e o conteúdo serão preenchidos automaticamente.
          </p>
        </div>

        <div className="space-y-1">
          <label className="block font-medium" htmlFor="filename">
            filename
          </label>
          <input
            id="filename"
            className="w-full max-w-md rounded border p-2"
            value={filename}
            onChange={(e) => setFilename(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="block font-medium" htmlFor="srtContent">
            srtContent
          </label>
          <textarea
            id="srtContent"
            className="min-h-[280px] w-full max-w-3xl rounded border p-2 font-mono text-sm"
            value={srtContent}
            onChange={(e) => setSrtContent(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-60"
          onClick={handleSubmit}
          disabled={loading || !projectId}
        >
          {loading ? "Enviando..." : "Enviar para /api/upload-srt"}
        </button>
      </div>

      {submitError ? (
        <pre className="mt-4 whitespace-pre-wrap rounded border border-red-200 bg-red-50 p-3 font-mono text-sm text-red-800">
          {submitError}
        </pre>
      ) : null}

      {submitSuccess ? (
        <pre className="mt-4 whitespace-pre-wrap rounded border border-green-200 bg-green-50 p-3 font-mono text-sm text-green-800">
          {submitSuccess}
        </pre>
      ) : null}

      {responseJson ? (
        <section className="mt-4 max-w-3xl space-y-3 rounded border bg-white p-3">
          <div>
            <p className="text-sm font-semibold">subtitleFileId</p>
            <p className="font-mono text-sm">{responseJson.subtitleFileId}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <a
              className="rounded border px-3 py-1 text-sm hover:bg-zinc-50"
              href={`/subtitle-file-edit?subtitleFileId=${encodeURIComponent(responseJson.subtitleFileId)}`}
            >
              Abrir no editor
            </a>
            <a
              className="rounded border px-3 py-1 text-sm hover:bg-zinc-50"
              href={`/subtitle-file-view?subtitleFileId=${encodeURIComponent(responseJson.subtitleFileId)}`}
            >
              Visualizar cues
            </a>
          </div>

          <pre className="whitespace-pre-wrap rounded border bg-zinc-50 p-3 font-mono text-sm">
            {JSON.stringify(responseJson, null, 2)}
          </pre>
        </section>
      ) : null}
    </main>
  );
}

