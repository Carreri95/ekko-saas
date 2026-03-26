"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Props = {
  open: boolean;
  previewUrl: string | null;
  onClose: () => void;
  onSaved: () => void;
};

const ZOOM_MIN = 1;
const ZOOM_MAX = 3;
const OUT_SIZE = 512;

function renderCroppedCanvas(
  img: HTMLImageElement,
  zoom: number,
): HTMLCanvasElement | null {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  if (iw <= 0 || ih <= 0) return null;
  const minSide = Math.min(iw, ih);
  const z = Math.min(Math.max(zoom, ZOOM_MIN), ZOOM_MAX);
  const side = minSide / z;
  const sx = (iw - side) / 2;
  const sy = (ih - side) / 2;

  const canvas = document.createElement("canvas");
  canvas.width = OUT_SIZE;
  canvas.height = OUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, sx, sy, side, side, 0, 0, OUT_SIZE, OUT_SIZE);
  return canvas;
}

export function AvatarCropModal({ open, previewUrl, onClose, onSaved }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1.25);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setZoom(1.25);
      setError(null);
    }
  }, [open, previewUrl]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const onSave = useCallback(async () => {
    const img = imgRef.current;
    if (!img || !previewUrl) return;
    setError(null);
    setLoading(true);
    try {
      const canvas = renderCroppedCanvas(img, zoom);
      if (!canvas) {
        setError("Não foi possível processar a imagem.");
        return;
      }
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92),
      );
      if (!blob) {
        setError("Não foi possível gerar o ficheiro.");
        return;
      }
      const fd = new FormData();
      fd.append("avatar", blob, "avatar.jpg");
      const res = await fetch("/api/users/avatar", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as unknown;
      if (!res.ok) {
        const msg =
          data && typeof data === "object" && "error" in data
            ? String((data as { error?: unknown }).error ?? "")
            : "";
        setError(msg || "Falha ao enviar a foto.");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Falha ao enviar a foto.");
    } finally {
      setLoading(false);
    }
  }, [previewUrl, zoom, onClose, onSaved]);

  if (!open || !previewUrl) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/60"
        onClick={loading ? undefined : onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal
        aria-labelledby="avatar-crop-title"
        className="fixed left-1/2 top-1/2 z-[70] w-[min(100vw-24px,380px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[10px] border border-[#2e2e2e] bg-[#1a1a1a] shadow-[0_16px_48px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center justify-between border-b border-[#252525] px-[16px] py-[12px]">
          <span
            id="avatar-crop-title"
            className="text-[13px] font-[600] text-[#e8e8e8]"
          >
            Ajustar foto
          </span>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex h-[22px] w-[22px] items-center justify-center rounded-[4px] text-[16px] text-[#505050] transition-colors hover:bg-[#252525] hover:text-[#e8e8e8] disabled:opacity-40"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-4 p-[16px]">
          <div className="flex flex-col items-center gap-3">
            <div className="relative h-[200px] w-[200px] overflow-hidden rounded-full bg-[#111] ring-1 ring-[#2e2e2e]">
              <div
                className="flex h-full w-full items-center justify-center"
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "center center",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  src={previewUrl}
                  alt=""
                  className="h-full w-full min-h-[200px] min-w-[200px] object-cover"
                />
              </div>
            </div>
            <div className="w-full px-1">
              <label
                className="mb-1 block text-[10px] font-[600] uppercase tracking-[0.06em] text-[#505050]"
                htmlFor="avatar-zoom"
              >
                Zoom
              </label>
              <input
                id="avatar-zoom"
                type="range"
                min={ZOOM_MIN}
                max={ZOOM_MAX}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                disabled={loading}
                className="w-full accent-[#1D9E75]"
              />
            </div>
          </div>

          {error ? (
            <p className="text-center text-[12px] text-[#f87171]" role="alert">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-[6px] border-t border-[#252525] pt-[10px]">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-[5px] border border-[#2e2e2e] px-[12px] py-[6px] text-[11px] text-[#606060] transition-colors hover:bg-[#252525] disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={loading}
              className="rounded-[5px] border border-[#0F6E56] bg-[#1D9E75] px-[14px] py-[6px] text-[11px] font-[500] text-white transition-colors hover:bg-[#0F6E56] disabled:opacity-40"
            >
              {loading ? "A enviar…" : "Salvar foto"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
