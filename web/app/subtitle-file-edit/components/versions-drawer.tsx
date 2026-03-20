"use client";

type VersionItem = {
  id: string;
  versionNumber: number;
  createdAt: string;
};

type VersionsDrawerProps = {
  open: boolean;
  loading: boolean;
  versions: VersionItem[];
  onClose: () => void;
};

export function VersionsDrawer({
  open,
  loading,
  versions,
  onClose,
}: VersionsDrawerProps) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="editor-versions-drawer-backdrop fixed inset-0 z-[100] cursor-default border-0 bg-black/55 p-0"
        aria-label="Fechar histórico de versões"
        onClick={onClose}
      />
      <div
        className="editor-versions-drawer-panel fixed right-0 top-0 z-[101] flex h-full w-full max-w-md flex-col border-l border-zinc-700/90 bg-zinc-950 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-versions-drawer-title"
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-zinc-800/80 bg-zinc-950/95 px-4 py-2.5">
          <div>
            <p
              id="editor-versions-drawer-title"
              className="text-[13px] font-semibold text-zinc-200"
            >
              Histórico
            </p>
            <p className="text-[10px] text-zinc-600">
              Consulta apenas · sem rollback
            </p>
          </div>
          <button
            type="button"
            className="rounded-md border border-zinc-600 bg-zinc-900 px-2.5 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-800"
            onClick={onClose}
          >
            Fechar
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <p className="text-sm text-zinc-300">Carregando versões...</p>
          ) : versions.length === 0 ? (
            <p className="text-sm text-zinc-300">
              Nenhuma versão registrada ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="rounded-md border border-zinc-700 bg-zinc-900/80 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded border border-zinc-700 bg-zinc-950 px-2 py-0.5 font-mono text-xs text-zinc-200">
                      v{version.versionNumber}
                    </span>
                    <span className="font-mono text-xs text-zinc-400">
                      {version.createdAt}
                    </span>
                  </div>
                  <p className="mt-2 font-mono text-[11px] text-zinc-500 break-all">
                    {version.id}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
