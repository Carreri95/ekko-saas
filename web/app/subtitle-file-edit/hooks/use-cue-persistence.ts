"use client";

import { useCallback } from "react";
import type { PersistOptions, SaveResponse, UseCuePersistenceParams } from "../types";

export function useCuePersistence({
  subtitleFileId,
  cues,
  minGapMs,
  autoSaveInFlightRef,
  lastSavedServerHashRef,
  sanitizeSubtitleFileId,
  validateCuesForSave,
  toSaveCuePayload,
  normalizeCueCollisions,
  getSaveCueHash,
  logBrowserError,
  setSaving,
  setError,
  setSaveSuccess,
  setCues,
}: UseCuePersistenceParams) {
  const persistCuesToServer = useCallback(
    async (options: PersistOptions) => {
      const id = sanitizeSubtitleFileId(subtitleFileId);
      if (!id) return false;
      if (autoSaveInFlightRef.current) return false;
      const validationError = validateCuesForSave(cues);
      if (validationError) {
        if (options.showSuccess) {
          setError(validationError);
        }
        return false;
      }

      autoSaveInFlightRef.current = true;
      if (options.showSuccess) {
        setSaving(true);
        setError(null);
        setSaveSuccess(null);
      }

      try {
        const res = await fetch("/api/subtitle-cues/bulk-update", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subtitleFileId: id,
            cues: toSaveCuePayload(cues),
          }),
        });

        const json = await res.json();
        if (!res.ok) {
          const message =
            json && typeof json === "object" && "error" in json
              ? String((json as { error: unknown }).error)
              : "Falha ao salvar alterações.";
          if (options.showSuccess) {
            setError(`Erro ${res.status}: ${message}`);
          }
          return false;
        }

        const response = json as SaveResponse;
        if (options.syncServerResponseToUi) {
          const normalized = normalizeCueCollisions(
            response.cues.map((cue) => ({
              ...cue,
              id: cue.id,
              tempId: cue.id,
            })),
            minGapMs,
          );
          setCues(normalized);
          lastSavedServerHashRef.current = getSaveCueHash(normalized);
        } else {
          // Auto-save silencioso: mantém tempIds/estado local estáveis para não afetar a waveform.
          lastSavedServerHashRef.current = getSaveCueHash(cues);
        }
        if (options.showSuccess) {
          setSaveSuccess("Revisão gravada com sucesso.");
        }
        return true;
      } catch (error) {
        logBrowserError("persistCuesToServer", error);
        if (options.showSuccess) {
          setError(error instanceof Error ? error.message : String(error));
        }
        return false;
      } finally {
        autoSaveInFlightRef.current = false;
        if (options.showSuccess) {
          setSaving(false);
        }
      }
    },
    [
      subtitleFileId,
      cues,
      minGapMs,
      autoSaveInFlightRef,
      lastSavedServerHashRef,
      sanitizeSubtitleFileId,
      validateCuesForSave,
      toSaveCuePayload,
      normalizeCueCollisions,
      getSaveCueHash,
      logBrowserError,
      setSaving,
      setError,
      setSaveSuccess,
      setCues,
    ],
  );

  return { persistCuesToServer };
}
