"use client";

import { useCallback } from "react";
import type { UseCueEditorNavigationParams } from "../types";

export function useCueEditorNavigation({
  cues,
  editingCueIndex,
  setSelectedCueTempId,
  setCueEditFocusTempId,
  setEditingCueTempId,
  updateCue,
  onBeforeCommitCueText,
  seekPlayerToCue,
  scrollWaveformToCueStart,
  focusCueCardInList,
}: UseCueEditorNavigationParams) {
  const handleEditorCommitText = useCallback(
    (cueTempId: string, text: string) => {
      onBeforeCommitCueText?.(cueTempId);
      updateCue(cueTempId, { text });
    },
    [updateCue, onBeforeCommitCueText],
  );

  const handleEditorNavigate = useCallback(
    (direction: "prev" | "next") => {
      if (editingCueIndex < 0) return;
      const nextIndex = direction === "prev" ? editingCueIndex - 1 : editingCueIndex + 1;
      if (nextIndex < 0 || nextIndex >= cues.length) return;
      const nextCue = cues[nextIndex];
      setSelectedCueTempId(nextCue.tempId);
      setCueEditFocusTempId(nextCue.tempId);
      setEditingCueTempId(nextCue.tempId);
      seekPlayerToCue(nextCue.startMs);
      scrollWaveformToCueStart(nextCue.startMs);
      focusCueCardInList(nextCue.tempId);
    },
    [
      cues,
      editingCueIndex,
      setSelectedCueTempId,
      setCueEditFocusTempId,
      setEditingCueTempId,
      seekPlayerToCue,
      scrollWaveformToCueStart,
      focusCueCardInList,
    ],
  );

  return { handleEditorCommitText, handleEditorNavigate };
}
