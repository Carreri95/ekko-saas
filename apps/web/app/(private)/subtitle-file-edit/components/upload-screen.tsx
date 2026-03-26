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
  const srtIsDone = srtLoaded;
  /** Com legenda em memória mas sem média — destacar zona de áudio. */
  const nudgeAudioAfterSrt = srtLoaded;

  const dropBase =
    "flex min-h-[12rem] flex-col items-center justify-center gap-5 rounded-[var(--radius-lg)] border-[0.5px] border-dashed px-6 py-8 text-center transition-colors";
  const dropBg = "bg-[var(--bg-surface)]";
  const zoneIdle =
    "border-[var(--border-strong)] hover:border-[var(--border-mid)]";
  const zoneFromDrag = (dropActive: boolean) =>
    dropActive
      ? "border-[var(--accent)] bg-[var(--bg-selected)]"
      : zoneIdle;

  const srtZoneClass = `${dropBase} ${dropBg} ${zoneFromDrag(srtDropActive)}`;
  const audioZoneClass = `${dropBase} ${dropBg} ${zoneFromDrag(audioDropActive)}`;

  return (
    <section className="editor-upload-screen flex min-h-0 flex-1 flex-col overflow-auto">
      <div className="flex min-h-[min(100%,32rem)] flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-2xl">
          <h1 className="mb-10 text-center text-[var(--fs-base)] font-semibold leading-snug tracking-wide text-[var(--text-secondary)]">
            Arraste seus ficheiros aqui
          </h1>

          <div className="grid w-full gap-4 sm:grid-cols-2">
            {srtIsDone ? (
              <div
                className={`${dropBase} ${dropBg} border-[var(--accent-hover)] opacity-95`}
              >
                <span className="text-xl text-[var(--accent-text)]">✓</span>
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {srtFilename ?? "Legenda carregada"}
                </p>
                <p className="text-[11px] leading-relaxed text-[var(--text-muted)]">
                  {srtCount} legendas prontas
                </p>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={onPickSrt}
                >
                  Trocar ficheiro
                </button>
              </div>
            ) : (
              <div
                className={`${srtZoneClass} ${
                  !srtLoaded ? "editor-upload-accent-pulse" : ""
                }`}
                onDragEnter={onSrtDragEnter}
                onDragLeave={onSrtDragLeave}
                onDragOver={onSrtDragOver}
                onDrop={onSrtDrop}
              >
                <p className="text-sm font-semibold leading-snug text-[var(--text-primary)]">
                  Legenda .srt
                </p>
                <p className="max-w-[15rem] text-[11px] leading-[1.65] text-[var(--text-muted)]">
                  Arraste o ficheiro para esta área ou escolha no disco.
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={onPickSrt}
                >
                  Escolher .srt
                </button>
              </div>
            )}

            <div
              className={`${audioZoneClass} ${
                nudgeAudioAfterSrt ? "editor-upload-accent-pulse" : ""
              }`}
              onDragEnter={onAudioDragEnter}
              onDragLeave={onAudioDragLeave}
              onDragOver={onAudioDragOver}
              onDrop={onAudioDrop}
            >
              <p className="text-sm font-semibold leading-snug text-[var(--text-primary)]">
                Áudio / vídeo
              </p>
              <p className="max-w-[15rem] text-[11px] leading-[1.65] text-[var(--text-muted)]">
                WAV, MP3 ou vídeo para referência.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
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
