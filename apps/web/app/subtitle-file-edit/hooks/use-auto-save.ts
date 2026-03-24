"use client";

import { useEffect, useRef } from "react";
import type { UseAutoSaveParams } from "../types";
import { getSaveCueHash, validateCuesForSave } from "../lib/cue-utils";

export function useAutoSave({
  subtitleFileId,
  cues,
  loading,
  autoSaveTimerRef,
  autoSaveInFlightRef,
  lastSavedServerHashRef,
  persistCuesToServer,
}: UseAutoSaveParams): void {
  const persistRef = useRef(persistCuesToServer);

  useEffect(() => {
    persistRef.current = persistCuesToServer;
  }, [persistCuesToServer]);

  useEffect(() => {
    const id = subtitleFileId.trim();
    if (!id || loading || !cues.length) return;
    const validationError = validateCuesForSave(cues);
    if (validationError) return;
    const nextHash = getSaveCueHash(cues);
    if (nextHash === lastSavedServerHashRef.current) return;
    if (autoSaveInFlightRef.current) return;

    if (autoSaveTimerRef.current) {
      window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      void persistRef.current({
        showSuccess: false,
        syncServerResponseToUi: false,
      });
    }, 700);

    return () => {
      if (autoSaveTimerRef.current) {
        window.clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [
    subtitleFileId,
    cues,
    loading,
    autoSaveTimerRef,
    autoSaveInFlightRef,
    lastSavedServerHashRef,
  ]);
}
