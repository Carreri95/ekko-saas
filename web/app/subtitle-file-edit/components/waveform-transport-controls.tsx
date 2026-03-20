"use client";

type WaveformTransportControlsProps = {
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
};

export function WaveformTransportControls({
  onPlay,
  onPause,
  onReset,
}: WaveformTransportControlsProps) {
  return (
    <div className="editor-transport-bar editor-transport-bar--dock flex h-full items-center justify-center gap-1.5 px-3">
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        className="flex h-[36px] w-9 items-center justify-center rounded-md border border-zinc-700/80 bg-transparent text-[13px] text-zinc-400 hover:border-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-100 transition-colors"
        onClick={onReset}
        title="Voltar ao início"
      >
        ⏮
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        className="flex h-[36px] w-14 items-center justify-center rounded-md bg-blue-600 text-[15px] text-white hover:bg-blue-500 transition-colors"
        onClick={onPlay}
        title="Play (Espaço)"
      >
        ▶
      </button>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        className="flex h-[36px] w-9 items-center justify-center rounded-md border border-zinc-700/80 bg-transparent text-[13px] text-zinc-400 hover:border-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-100 transition-colors"
        onClick={onPause}
        title="Pausar (Espaço)"
      >
        ‖
      </button>
    </div>
  );
}
