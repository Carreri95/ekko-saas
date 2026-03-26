"use client";

import { useEffect } from "react";
import { isCueVisibleInListPanel, scrollCueIntoListPanel } from "../lib/dom-utils";
import type { UseCueListAutoScrollParams } from "../types";

export function useCueListAutoScroll({
  activeCueTempId,
  selectedCueTempId,
  mediaElementRef,
  lastAutoScrollAtRef,
  cueItemRefs,
  cueListScrollRef,
}: UseCueListAutoScrollParams): void {
  useEffect(() => {
    if (!activeCueTempId) return;
    if (selectedCueTempId && selectedCueTempId !== activeCueTempId) {
      return;
    }
    const media = mediaElementRef.current;
    if (!media || media.paused) return;

    const now = Date.now();
    if (now - lastAutoScrollAtRef.current < 700) return;

    const activeElement = cueItemRefs.current[activeCueTempId];
    const panel = cueListScrollRef.current;
    if (!activeElement || !panel) return;

    if (isCueVisibleInListPanel(activeElement, panel)) return;

    scrollCueIntoListPanel(activeElement, panel);
    lastAutoScrollAtRef.current = now;
  }, [
    activeCueTempId,
    selectedCueTempId,
    mediaElementRef,
    lastAutoScrollAtRef,
    cueItemRefs,
    cueListScrollRef,
  ]);
}
