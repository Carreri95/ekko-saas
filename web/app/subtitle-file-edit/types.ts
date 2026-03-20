export type CueDto = {
  id: string | null;
  tempId: string;
  cueIndex: number;
  startMs: number;
  endMs: number;
  text: string;
};

export type SubtitleFileResponse = {
  subtitleFileId: string;
  filename: string;
  wavFilename: string | null;
  wavPath: string | null;
  projectId: string;
  cues: CueDto[];
};

export type SaveResponse = {
  subtitleFileId: string;
  updatedCount: number;
  versionId: string;
  versionNumber: number;
  versionCreatedAt: string;
  cues: Array<{
    id: string;
    cueIndex: number;
    startMs: number;
    endMs: number;
    text: string;
  }>;
};

export type VersionItem = {
  id: string;
  versionNumber: number;
  createdAt: string;
};

export type VersionsResponse = {
  subtitleFileId: string;
  versions: VersionItem[];
};

export type ProblemFilter =
  | "all"
  | "problematic"
  | "invalid-time"
  | "empty-text"
  | "overlap"
  | "short-duration"
  | "long-duration";

export type AspectRatio = "16:9" | "9:16" | "1:1";

export type LocalWaveformData = {
  peaks: number[][];
  duration: number;
};
