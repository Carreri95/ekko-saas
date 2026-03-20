"use client";

import { useCallback } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { CueDto, LocalWaveformData } from "../types";

type UseLocalMediaSrtIntakeParams = {
  setLocalWaveformData: Dispatch<SetStateAction<LocalWaveformData | null>>;
  setMediaSourceUrl: Dispatch<SetStateAction<string | null>>;
  setMediaKind: Dispatch<SetStateAction<"video" | "audio" | null>>;
  setCurrentPlaybackMs: Dispatch<SetStateAction<number>>;
  setError: Dispatch<SetStateAction<string | null>>;
  setSaveSuccess: Dispatch<SetStateAction<string | null>>;
  setCues: Dispatch<SetStateAction<CueDto[]>>;
  setFilename: Dispatch<SetStateAction<string | null>>;
  setSelectedCueTempId: Dispatch<SetStateAction<string | null>>;
  setCueEditFocusTempId: Dispatch<SetStateAction<string | null>>;
  setEditingCueTempId: Dispatch<SetStateAction<string | null>>;
  setSrtDropActive: Dispatch<SetStateAction<boolean>>;
  setAudioDropActive: Dispatch<SetStateAction<boolean>>;
  toCueDtoListFromSrtText: (text: string) => CueDto[];
  resetPlaybackToStart: () => void;
  logBrowserError: (context: string, error: unknown) => void;
};

export function useLocalMediaSrtIntake({
  setLocalWaveformData,
  setMediaSourceUrl,
  setMediaKind,
  setCurrentPlaybackMs,
  setError,
  setSaveSuccess,
  setCues,
  setFilename,
  setSelectedCueTempId,
  setCueEditFocusTempId,
  setEditingCueTempId,
  setSrtDropActive,
  setAudioDropActive,
  toCueDtoListFromSrtText,
  resetPlaybackToStart,
  logBrowserError,
}: UseLocalMediaSrtIntakeParams) {
  const buildWaveformDataFromFile = useCallback(async (file: File): Promise<LocalWaveformData> => {
    const buffer = await file.arrayBuffer();
    const audioContext = new AudioContext();
    try {
      const decoded = await audioContext.decodeAudioData(buffer.slice(0));
      const duration = decoded.duration;
      const samples = Math.max(800, Math.min(8000, Math.round(duration * 80)));
      const peaks: number[][] = [];

      for (let channelIndex = 0; channelIndex < decoded.numberOfChannels; channelIndex += 1) {
        const channelData = decoded.getChannelData(channelIndex);
        const blockSize = Math.max(1, Math.floor(channelData.length / samples));
        const channelPeaks: number[] = new Array(samples);

        for (let sampleIndex = 0; sampleIndex < samples; sampleIndex += 1) {
          const start = sampleIndex * blockSize;
          const end = Math.min(start + blockSize, channelData.length);
          let max = 0;
          for (let i = start; i < end; i += 1) {
            const value = Math.abs(channelData[i] ?? 0);
            if (value > max) max = value;
          }
          channelPeaks[sampleIndex] = Number(max.toFixed(4));
        }
        peaks.push(channelPeaks);
      }

      return { peaks, duration };
    } finally {
      void audioContext.close();
    }
  }, []);

  const applyLocalMediaFile = useCallback(
    (file: File) => {
      const objectUrl = URL.createObjectURL(file);
      setLocalWaveformData(null);
      setMediaSourceUrl(objectUrl);
      const isAudio =
        file.type.startsWith("audio/") ||
        /\.(wav|mp3|ogg|m4a|aac|flac|opus)$/i.test(file.name);
      setMediaKind(isAudio ? "audio" : "video");
      setCurrentPlaybackMs(0);
      if (isAudio) {
        void buildWaveformDataFromFile(file)
          .then((data) => {
            setLocalWaveformData(data);
          })
          .catch((error) => {
            logBrowserError("buildWaveformDataFromFile", error);
          });
      }
    },
    [
      setLocalWaveformData,
      setMediaSourceUrl,
      setMediaKind,
      setCurrentPlaybackMs,
      buildWaveformDataFromFile,
      logBrowserError,
    ],
  );

  const isMediaDropFile = useCallback((file: File): boolean => {
    if (file.type.startsWith("audio/") || file.type.startsWith("video/")) return true;
    return /\.(wav|mp3|ogg|m4a|aac|flac|opus|mp4|webm|mkv)$/i.test(file.name);
  }, []);

  const queueLocalMediaFromFiles = useCallback(
    (files: File[]) => {
      const media = files.find((f) => isMediaDropFile(f));
      if (!media) {
        setError("Largue ou escolha um ficheiro de áudio ou vídeo (ex. WAV, MP3).");
        return false;
      }
      setError(null);
      applyLocalMediaFile(media);
      return true;
    },
    [isMediaDropFile, setError, applyLocalMediaFile],
  );

  const applyDroppedSrtFile = useCallback(
    async (file: File) => {
      if (!file.name.toLowerCase().endsWith(".srt")) {
        setError("Use um ficheiro .srt.");
        return;
      }
      setError(null);
      setSaveSuccess(null);
      try {
        const text = await file.text();
        const nextCues = toCueDtoListFromSrtText(text);
        setCues(nextCues);
        setFilename(file.name);
        resetPlaybackToStart();
        setSelectedCueTempId(null);
        setCueEditFocusTempId(null);
        setEditingCueTempId(null);
      } catch (error) {
        logBrowserError("applyDroppedSrtFile", error);
        setError(error instanceof Error ? error.message : String(error));
      }
    },
    [
      setError,
      setSaveSuccess,
      toCueDtoListFromSrtText,
      setCues,
      setFilename,
      resetPlaybackToStart,
      setSelectedCueTempId,
      setCueEditFocusTempId,
      setEditingCueTempId,
      logBrowserError,
    ],
  );

  const handleEmptySrtDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setSrtDropActive(false);
      const files = Array.from(e.dataTransfer.files);
      const srt = files.find((f) => f.name.toLowerCase().endsWith(".srt"));
      if (!srt) {
        setError("Largue um ficheiro .srt nesta área.");
        return;
      }
      void applyDroppedSrtFile(srt);
    },
    [setSrtDropActive, setError, applyDroppedSrtFile],
  );

  const handleEmptyAudioDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setAudioDropActive(false);
      queueLocalMediaFromFiles(Array.from(e.dataTransfer.files));
    },
    [setAudioDropActive, queueLocalMediaFromFiles],
  );

  return {
    applyLocalMediaFile,
    queueLocalMediaFromFiles,
    applyDroppedSrtFile,
    handleEmptySrtDrop,
    handleEmptyAudioDrop,
  };
}
