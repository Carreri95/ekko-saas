export default function Home() {
  return (
    <main className="min-h-screen p-6">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">SubtitleBot — MVP 1</h1>
      <p className="mt-2 text-zinc-700 dark:text-zinc-300">
        Navegação rápida para os fluxos de teste internos.
      </p>

      <section className="mt-6 grid gap-2 sm:max-w-xl">
        <a
          className="rounded border border-zinc-300 bg-white px-4 py-2 text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          href="/project-create-demo"
        >
          1) Criar/obter Project Demo
        </a>
        <a
          className="rounded border border-zinc-300 bg-white px-4 py-2 text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          href="/srt-parser-test"
        >
          2) Testar parser de SRT
        </a>
        <a
          className="rounded border border-zinc-300 bg-white px-4 py-2 text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          href="/srt-upload-test"
        >
          3) Persistir SRT no banco
        </a>
        <a
          className="rounded border border-zinc-300 bg-white px-4 py-2 text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          href="/subtitle-file-view"
        >
          4) Visualizar cues salvos
        </a>
        <a
          className="rounded border border-zinc-300 bg-white px-4 py-2 text-zinc-900 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          href="/subtitle-file-edit"
        >
          5) Editar cues e exportar .srt
        </a>
      </section>
    </main>
  );
}
