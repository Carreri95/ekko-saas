"use client";

import { useState } from "react";

type DemoProjectResponse = {
  projectId: string;
  projectName: string;
} | {
  error: string;
};

export default function ProjectCreateDemoPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DemoProjectResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    setResult(null);

    try {
      const res = await fetch("/api/projects/demo");
      const data = (await res.json()) as DemoProjectResponse;
      if (!res.ok) {
        const message =
          typeof data === "object" && data && "error" in data
            ? (data as { error: string }).error
            : "Falha na requisição";
        setError(`Erro ${res.status}: ${message}`);
        return;
      }
      setResult(data);
      setSuccess("Project Demo obtido com sucesso.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-semibold">Projeto Demo</h1>
      <p className="mt-2 text-zinc-600">Criar/obter o Project Demo para o usuário seed.</p>
      <nav className="mt-3 flex flex-wrap gap-2 text-sm">
        <a className="rounded border px-3 py-1 hover:bg-zinc-50" href="/srt-upload-test">
          Upload SRT Test
        </a>
        <a className="rounded border px-3 py-1 hover:bg-zinc-50" href="/srt-parser-test">
          Parser Test
        </a>
      </nav>

      <button
        className="mt-4 rounded bg-black px-4 py-2 text-white disabled:opacity-60"
        onClick={handleClick}
        type="button"
        disabled={loading}
      >
        {loading ? "Carregando..." : "Criar/Obter Project Demo"}
      </button>

      {error ? (
        <pre className="mt-4 whitespace-pre-wrap rounded border border-red-200 bg-red-50 p-3 font-mono text-sm text-red-800">
          {error}
        </pre>
      ) : null}

      {success ? (
        <pre className="mt-4 whitespace-pre-wrap rounded border border-green-200 bg-green-50 p-3 font-mono text-sm text-green-800">
          {success}
        </pre>
      ) : null}

      {result ? (
        <pre className="mt-4 max-w-xl whitespace-pre-wrap rounded border bg-white p-3 font-mono text-sm">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
    </main>
  );
}

