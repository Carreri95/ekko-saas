"use client";

import { useState } from "react";

import { parseSrt } from "../../src/lib/srt/parse-srt";
import type { SubtitleCue } from "../../src/types/subtitle";

const DEFAULT_SRT = `1
00:00:01,000 --> 00:00:03,000
Olá, tudo bem?

2
00:00:04,000 --> 00:00:06,500
Vamos começar.`;

export default function SrtParserTestPage() {
  const [srtText, setSrtText] = useState(DEFAULT_SRT);
  const [cues, setCues] = useState<SubtitleCue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleParse() {
    try {
      const parsed = parseSrt(srtText);
      setCues(parsed);
      setError(null);
      setSuccess(`Parse concluido. Cues encontrados: ${parsed.length}.`);
    } catch (e) {
      setCues(null);
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      setSuccess(null);
    }
  }

  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-semibold">Teste do Parser SRT</h1>
      <nav className="mt-3 flex flex-wrap gap-2 text-sm">
        <a className="rounded border px-3 py-1 hover:bg-zinc-50" href="/project-create-demo">
          Project Demo
        </a>
        <a className="rounded border px-3 py-1 hover:bg-zinc-50" href="/srt-upload-test">
          Upload SRT Test
        </a>
      </nav>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="flex flex-col gap-2">
          <label className="font-medium" htmlFor="srt">
            Conteúdo `.srt`
          </label>
          <textarea
            id="srt"
            className="min-h-[320px] w-full resize-y rounded border p-3 font-mono text-sm"
            value={srtText}
            onChange={(e) => setSrtText(e.target.value)}
          />
          <button
            className="w-fit rounded bg-black px-4 py-2 text-white"
            onClick={handleParse}
            type="button"
          >
            Parsear
          </button>
        </section>

        <section>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Cues</h2>
          </div>

          {error ? (
            <pre className="mt-2 whitespace-pre-wrap rounded border border-red-300 bg-red-50 p-3 font-mono text-sm text-red-800">
              {error}
            </pre>
          ) : null}

          {success ? (
            <pre className="mt-2 whitespace-pre-wrap rounded border border-green-200 bg-green-50 p-3 font-mono text-sm text-green-800">
              {success}
            </pre>
          ) : null}

          {cues ? (
            <pre className="mt-2 max-h-[520px] overflow-auto whitespace-pre-wrap rounded border bg-white p-3 font-mono text-sm">
              {JSON.stringify(cues, null, 2)}
            </pre>
          ) : (
            <pre className="mt-2 whitespace-pre-wrap rounded border bg-white p-3 font-mono text-sm text-zinc-500">
              Clique em “Parsear” para ver o resultado.
            </pre>
          )}
        </section>
      </div>
    </main>
  );
}

