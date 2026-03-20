"use client";

import { useCallback, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CueDto } from "../types";

export type HistoryEntry = {
  cues: CueDto[];
  label: string;
};

function cloneCues(cues: CueDto[]): CueDto[] {
  return cues.map((c) => ({ ...c }));
}

/**
 * Stack de undo em memória (máx. 10 níveis). Cada `pushHistory` grava o estado
 * **antes** da mutação seguinte; `undo` restaura a entrada mais recente.
 */
export function useUndoHistory() {
  const historyRef = useRef<HistoryEntry[]>([]);

  const pushHistory = useCallback((currentCues: CueDto[], label: string) => {
    historyRef.current = [
      { cues: cloneCues(currentCues), label },
      ...historyRef.current,
    ].slice(0, 10);
  }, []);

  const undo = useCallback(
    (setCues: Dispatch<SetStateAction<CueDto[]>>): boolean => {
      const [last, ...rest] = historyRef.current;
      if (!last) return false;
      historyRef.current = rest;
      setCues(cloneCues(last.cues));
      return true;
    },
    [],
  );

  return { pushHistory, undo, historyRef };
}
