"use client";

import { useEffect } from "react";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { Project } from "@/src/types/project";
import type { CueDto } from "../types";
import { getSaveCueHash } from "../lib/cue-utils";

type UseQueueAutoSnapshotParams = {
  localProject: Project | null;
  currentEpisodeId: string | null;
  cues: CueDto[];
  queueSnapshotSyncTimerRef: MutableRefObject<number | null>;
  lastQueueSnapshotKeyRef: MutableRefObject<string>;
  setLocalProject: Dispatch<SetStateAction<Project | null>>;
  saveQueueState: (project: Project) => void;
};

export function useQueueAutoSnapshot({
  localProject,
  currentEpisodeId,
  cues,
  queueSnapshotSyncTimerRef,
  lastQueueSnapshotKeyRef,
  setLocalProject,
  saveQueueState,
}: UseQueueAutoSnapshotParams): void {
  useEffect(() => {
    if (!localProject || !currentEpisodeId || !cues.length) return;

    const nextHash = getSaveCueHash(cues);
    const nextKey = `${currentEpisodeId}:${nextHash}`;
    if (nextKey === lastQueueSnapshotKeyRef.current) return;

    if (queueSnapshotSyncTimerRef.current) {
      window.clearTimeout(queueSnapshotSyncTimerRef.current);
      queueSnapshotSyncTimerRef.current = null;
    }

    queueSnapshotSyncTimerRef.current = window.setTimeout(() => {
      queueSnapshotSyncTimerRef.current = null;
      setLocalProject((prev) => {
        if (!prev || !currentEpisodeId) return prev;
        const nextEpisodes = prev.episodes.map((ep) =>
          ep.id === currentEpisodeId
            ? {
                ...ep,
                editedCues: cues.map((cue) => ({ ...cue })),
              }
            : ep,
        );
        const nextProject = { ...prev, episodes: nextEpisodes };
        saveQueueState(nextProject);
        lastQueueSnapshotKeyRef.current = nextKey;
        return nextProject;
      });
    }, 350);

    return () => {
      if (queueSnapshotSyncTimerRef.current) {
        window.clearTimeout(queueSnapshotSyncTimerRef.current);
        queueSnapshotSyncTimerRef.current = null;
      }
    };
  }, [
    cues,
    localProject,
    currentEpisodeId,
    queueSnapshotSyncTimerRef,
    lastQueueSnapshotKeyRef,
    setLocalProject,
    saveQueueState,
  ]);
}
