"use client";

import { useEffect, useRef } from "react";
import type { UseGlobalDropIntakeParams } from "../types";

export function useGlobalDropIntake({
  subtitleFileId,
  cuesLength,
  mediaSourceUrl,
  sanitizeSubtitleFileId,
  applyDroppedSrtFile,
  queueLocalMediaFromFiles,
}: UseGlobalDropIntakeParams) {
  const applySrtRef = useRef(applyDroppedSrtFile);
  const queueMediaRef = useRef(queueLocalMediaFromFiles);

  useEffect(() => {
    applySrtRef.current = applyDroppedSrtFile;
    queueMediaRef.current = queueLocalMediaFromFiles;
  }, [applyDroppedSrtFile, queueLocalMediaFromFiles]);

  useEffect(() => {
    const hasServerSubtitleFile = sanitizeSubtitleFileId(subtitleFileId) !== "";
    const isEditorReady = hasServerSubtitleFile || (cuesLength > 0 && mediaSourceUrl !== null);
    if (isEditorReady) return;

    const onDragOver = (e: DragEvent) => {
      e.preventDefault();
    };
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (!files.length) return;
      const srt = files.find((f) => f.name.toLowerCase().endsWith(".srt"));
      if (srt) {
        void applySrtRef.current(srt);
        return;
      }
      void queueMediaRef.current(files);
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [subtitleFileId, cuesLength, mediaSourceUrl, sanitizeSubtitleFileId]);
}
