"use client";

import type { UploadScreenProps } from "../types";

export function UploadScreen({
  srtLoaded,
  srtFilename,
  srtCount,
  srtDropActive,
  audioDropActive,
  onSrtDragEnter,
  onSrtDragLeave,
  onSrtDragOver,
  onSrtDrop,
  onAudioDragEnter,
  onAudioDragLeave,
  onAudioDragOver,
  onAudioDrop,
  onPickSrt,
  onPickAudio,
}: UploadScreenProps) {
  const srtIsActive = !srtLoaded;
  const srtIsDone = srtLoaded;
  const audioIsActive = srtLoaded;
  const audioIsInactive = !srtLoaded;

  return (
    <section className="editor-desktop-workspace editor-desktop-workspace--stacked-no-session min-h-0 flex-1 overflow-hidden">
      <div className="editor-workspace-split-empty flex min-h-0 flex-1 flex-col border-b border-zinc-800/90 bg-zinc-950/90 px-4 py-6">
        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center gap-6">
          <div className="text-center">
            <p className="text-[11px] font-semibold tracking-[0.08em] text-zinc-300">
              Arraste seus arquivos aqui
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {srtIsDone ? (
              <div className="flex min-h-[11rem] flex-col items-center justify-center rounded-lg border border-emerald-400/30 bg-emerald-500/5 px-4 py-5 text-center opacity-75">
                <span className="text-xl text-emerald-400">✓</span>
                <p className="mt-1 text-sm font-semibold text-zinc-200">
                  {srtFilename ?? "Legenda carregada"}
                </p>
                <p className="mt-1 text-[11px] text-zinc-500">
                  {srtCount} legendas prontas
                </p>
                <button
                  type="button"
                  className="mt-3 rounded border border-zinc-600 bg-zinc-900 px-3 py-1.5 text-[11px] font-medium text-zinc-300 hover:bg-zinc-800"
                  onClick={onPickSrt}
                >
                  Trocar arquivo
                </button>
              </div>
            ) : (
              <div
                className={`editor-entry-dropzone editor-entry-dropzone--srt ${
                  srtIsActive ? "editor-upload-audio-pulse" : ""
                } flex min-h-[11rem] flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${
                  srtDropActive
                    ? "border-sky-400/80 bg-sky-950/30"
                    : "border-sky-500/85 bg-sky-500/10 hover:border-sky-400"
                }`}
                onDragEnter={onSrtDragEnter}
                onDragLeave={onSrtDragLeave}
                onDragOver={onSrtDragOver}
                onDrop={onSrtDrop}
              >
                <p className="text-sm font-semibold text-zinc-200">
                  Legenda .srt
                </p>
                <p className="mt-1 max-w-[14rem] text-[11px] leading-snug text-zinc-500">
                  Arraste o ficheiro para esta área ou escolha no disco.
                </p>
                <button
                  type="button"
                  className="mt-3 rounded border border-sky-400/80 bg-sky-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-sky-500"
                  onClick={onPickSrt}
                >
                  Escolher .srt
                </button>
              </div>
            )}

            <div
              className={`editor-entry-dropzone editor-entry-dropzone--audio ${
                audioIsActive ? "editor-upload-audio-pulse" : ""
              } flex min-h-[11rem] flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors ${
                audioIsInactive
                  ? "pointer-events-none opacity-45 border-zinc-700/40 bg-transparent"
                  : audioDropActive
                    ? "border-sky-400/90 bg-sky-950/35"
                    : "border-sky-500/80 bg-sky-500/10 hover:border-sky-400"
              }`}
              onDragEnter={audioIsInactive ? undefined : onAudioDragEnter}
              onDragLeave={audioIsInactive ? undefined : onAudioDragLeave}
              onDragOver={audioIsInactive ? undefined : onAudioDragOver}
              onDrop={audioIsInactive ? undefined : onAudioDrop}
            >
              <p
                className={`text-sm font-semibold ${
                  audioIsInactive ? "text-zinc-500/80" : "text-zinc-100"
                }`}
              >
                Áudio / Vídeo
              </p>
              <p
                className={`mt-1 max-w-[14rem] text-[11px] leading-snug ${
                  audioIsInactive ? "text-zinc-600/80" : "text-zinc-400"
                }`}
              >
                WAV, MP3 ou vídeo para referência.
              </p>
              <button
                type="button"
                disabled={audioIsInactive}
                className={`mt-3 rounded px-3 py-1.5 text-[11px] font-semibold ${
                  audioIsInactive
                    ? "cursor-not-allowed border border-white/15 bg-transparent text-white/30"
                    : "border border-sky-400/80 bg-sky-600 text-white hover:bg-sky-500"
                }`}
                onClick={onPickAudio}
              >
                Escolher áudio
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
