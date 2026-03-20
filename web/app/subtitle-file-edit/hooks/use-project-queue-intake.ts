"use client";

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Episode, Project } from "@/src/types/project";

type UseProjectQueueIntakeParams = {
  restoreQueueProgress: (episodes: Episode[]) => Episode[];
  matchEpisodes: (files: File[]) => Episode[];
  inferProjectNameFromFiles: (files: File[]) => string;
  saveQueueState: (project: Project) => void;
  setLocalProject: Dispatch<SetStateAction<Project | null>>;
  setCurrentEpisodeId: Dispatch<SetStateAction<string | null>>;
  setScreenMode: Dispatch<SetStateAction<"upload" | "queue" | "editor">>;
  setError: Dispatch<SetStateAction<string | null>>;
};

export function useProjectQueueIntake({
  restoreQueueProgress,
  matchEpisodes,
  inferProjectNameFromFiles,
  saveQueueState,
  setLocalProject,
  setCurrentEpisodeId,
  setScreenMode,
  setError,
}: UseProjectQueueIntakeParams) {
  const processFolderFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (!files.length) {
        setError("A pasta selecionada não contém arquivos.");
        return;
      }
      const episodes = restoreQueueProgress(matchEpisodes(files));
      const project: Project = {
        name: inferProjectNameFromFiles(files),
        episodes,
        createdAt: new Date().toISOString(),
      };
      setLocalProject(project);
      setCurrentEpisodeId(null);
      setScreenMode("queue");
      saveQueueState(project);
      setError(null);
    },
    [
      restoreQueueProgress,
      matchEpisodes,
      inferProjectNameFromFiles,
      setLocalProject,
      setCurrentEpisodeId,
      setScreenMode,
      saveQueueState,
      setError,
    ],
  );

  const handleFolderInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        processFolderFiles(files);
      }
      e.target.value = "";
    },
    [processFolderFiles],
  );

  const handleFolderDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files ?? []);
      if (files.length > 0) {
        processFolderFiles(files);
      }
    },
    [processFolderFiles],
  );

  return { processFolderFiles, handleFolderInputChange, handleFolderDrop };
}
