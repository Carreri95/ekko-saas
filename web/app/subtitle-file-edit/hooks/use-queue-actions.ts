"use client";

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import { formatSrt } from "@/src/lib/srt/format-srt";
import type { Episode, Project } from "@/src/types/project";
import type { CueDto } from "../types";

type UseQueueActionsParams = {
  localProject: Project | null;
  currentEpisodeId: string | null;
  cues: CueDto[];
  setLocalProject: Dispatch<SetStateAction<Project | null>>;
  setCurrentEpisodeId: Dispatch<SetStateAction<string | null>>;
  setScreenMode: Dispatch<SetStateAction<"upload" | "queue" | "editor">>;
  setSaveSuccess: Dispatch<SetStateAction<string | null>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setCues: Dispatch<SetStateAction<CueDto[]>>;
  setFilename: Dispatch<SetStateAction<string | null>>;
  setSubtitleFileId: Dispatch<SetStateAction<string>>;
  setSelectedCueTempId: Dispatch<SetStateAction<string | null>>;
  setCueEditFocusTempId: Dispatch<SetStateAction<string | null>>;
  setEditingCueTempId: Dispatch<SetStateAction<string | null>>;
  saveQueueState: (nextProject: Project) => void;
  buildEpisodeCues: (episode: Episode) => Promise<CueDto[]>;
  resetPlaybackToStart: () => void;
  applyLocalMediaFile: (file: File) => void;
  clearMedia: () => void;
  logBrowserError: (context: string, error: unknown) => void;
};

export function useQueueActions({
  localProject,
  currentEpisodeId,
  cues,
  setLocalProject,
  setCurrentEpisodeId,
  setScreenMode,
  setSaveSuccess,
  setError,
  setCues,
  setFilename,
  setSubtitleFileId,
  setSelectedCueTempId,
  setCueEditFocusTempId,
  setEditingCueTempId,
  saveQueueState,
  buildEpisodeCues,
  resetPlaybackToStart,
  applyLocalMediaFile,
  clearMedia,
  logBrowserError,
}: UseQueueActionsParams) {
  const downloadEpisodeSrt = useCallback((ep: Episode) => {
    if (!ep.editedCues || ep.editedCues.length === 0) return;
    const srtContent = formatSrt(
      ep.editedCues.map((cue, idx) => ({
        cueIndex: idx + 1,
        startMs: cue.startMs,
        endMs: cue.endMs,
        text: cue.text,
      })),
    );
    const blob = new Blob([srtContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ep.name}.srt`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const updateEpisodeProgress = useCallback(
    (status: Episode["status"]): Project | null => {
      if (!localProject || !currentEpisodeId) return null;
      const updatedEpisodes = localProject.episodes.map((ep) =>
        ep.id === currentEpisodeId
          ? {
              ...ep,
              status,
              editedCues: cues.map((cue) => ({ ...cue })),
            }
          : ep,
      );
      const nextProject = { ...localProject, episodes: updatedEpisodes };
      setLocalProject(nextProject);
      saveQueueState(nextProject);
      return nextProject;
    },
    [localProject, currentEpisodeId, cues, setLocalProject, saveQueueState],
  );

  const openEpisodeById = useCallback(
    async (episodeId: string) => {
      if (!localProject) return;
      const episode = localProject.episodes.find((ep) => ep.id === episodeId);
      if (!episode || !episode.srtFile) return;
      try {
        const nextCues = await buildEpisodeCues(episode);

        setCues(nextCues);
        setFilename(episode.srtFile.name);
        setSubtitleFileId("");
        resetPlaybackToStart();
        setSelectedCueTempId(nextCues[0]?.tempId ?? null);
        setCueEditFocusTempId(nextCues[0]?.tempId ?? null);
        setEditingCueTempId(nextCues[0]?.tempId ?? null);

        if (episode.audioFile) {
          applyLocalMediaFile(episode.audioFile);
        } else {
          clearMedia();
        }

        const updatedEpisodes = localProject.episodes.map((ep) =>
          ep.id === episodeId && ep.status !== "done"
            ? { ...ep, status: "in_progress" as const }
            : ep,
        );
        const nextProject = { ...localProject, episodes: updatedEpisodes };
        setLocalProject(nextProject);
        saveQueueState(nextProject);
        setCurrentEpisodeId(episodeId);
        setScreenMode("editor");
        setError(null);
      } catch (error) {
        logBrowserError("openEpisodeById", error);
        setError(error instanceof Error ? error.message : String(error));
      }
    },
    [
      localProject,
      buildEpisodeCues,
      setCues,
      setFilename,
      setSubtitleFileId,
      resetPlaybackToStart,
      setSelectedCueTempId,
      setCueEditFocusTempId,
      setEditingCueTempId,
      applyLocalMediaFile,
      clearMedia,
      setLocalProject,
      saveQueueState,
      setCurrentEpisodeId,
      setScreenMode,
      setError,
      logBrowserError,
    ],
  );

  const handleDownloadEpisodeById = useCallback(
    (episodeId: string) => {
      if (!localProject) return;
      const ep = localProject.episodes.find((item) => item.id === episodeId);
      if (!ep) return;
      downloadEpisodeSrt(ep);
    },
    [localProject, downloadEpisodeSrt],
  );

  const saveAndStayQueueEpisode = useCallback(() => {
    if (!currentEpisodeId || !localProject) return;
    updateEpisodeProgress("in_progress");
    setSaveSuccess("Episódio salvo na fila local.");
  }, [currentEpisodeId, localProject, updateEpisodeProgress, setSaveSuccess]);

  const saveAndNextQueueEpisode = useCallback(async () => {
    if (!currentEpisodeId || !localProject) return;
    const nextProject = updateEpisodeProgress("done");
    if (!nextProject) return;
    const doneEp = nextProject.episodes.find((ep) => ep.id === currentEpisodeId);
    if (doneEp) {
      downloadEpisodeSrt(doneEp);
    }
    const currentIdx = nextProject.episodes.findIndex((ep) => ep.id === currentEpisodeId);
    const nextEpisode = nextProject.episodes.find(
      (ep, idx) => idx > currentIdx && ep.status !== "done" && ep.srtFile,
    );
    if (nextEpisode) {
      await openEpisodeById(nextEpisode.id);
      return;
    }
    setScreenMode("queue");
    setCurrentEpisodeId(null);
  }, [
    currentEpisodeId,
    localProject,
    updateEpisodeProgress,
    downloadEpisodeSrt,
    openEpisodeById,
    setScreenMode,
    setCurrentEpisodeId,
  ]);

  return {
    openEpisodeById,
    handleDownloadEpisodeById,
    saveAndStayQueueEpisode,
    saveAndNextQueueEpisode,
  };
}
