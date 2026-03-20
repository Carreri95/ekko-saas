"use client";

import { useCallback } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { CueDto, SaveResponse } from "../types";

type PersistOptions = {
  showSuccess: boolean;
  syncServerResponseToUi: boolean;
};

type UseCuePersistenceParams = {
  subtitleFileId: string;
  cues: CueDto[];
  minGapMs: number;
  autoSaveInFlightRef: MutableRefObject<boolean>;
  lastSavedServerHashRef: MutableRefObject<string>;
  sanitizeSubtitleFileId: (raw: string | null | undefined) => string;
  validateCuesForSave: (cues: CueDto[]) => string | null;
  toSaveCuePayload: (cues: CueDto[]) => Array<{
    id?: string;
    startMs: number;
    endMs: number;
    text: string;
  }>;
  normalizeCueCollisions: (cues: CueDto[], minGapMs: number) => CueDto[];
  getSaveCueHash: (cues: CueDto[]) => string;
  loadVersions: (id: string) => Promise<void>;
  logBrowserError: (context: string, error: unknown) => void;
  setSaving: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setSaveSuccess: Dispatch<SetStateAction<string | null>>;
  setCues: Dispatch<SetStateAction<CueDto[]>>;
};

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
  loadVersions,
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
        if (options.syncServerResponseToUi) {
          void loadVersions(id);
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
      loadVersions,
      logBrowserError,
      setSaving,
      setError,
      setSaveSuccess,
      setCues,
    ],
  );

  return { persistCuesToServer };
}
