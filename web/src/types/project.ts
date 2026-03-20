export type EpisodeCueSnapshot = {
  id: string | null;
  tempId: string;
  cueIndex: number;
  startMs: number;
  endMs: number;
  text: string;
};

export type EpisodeStatus =
  | "pending"
  | "in_progress"
  | "done"
  | "missing_audio"
  | "missing_srt";

export type Episode = {
  id: string;
  name: string;
  srtFile: File | null;
  audioFile: File | null;
  status: EpisodeStatus;
  editedCues: EpisodeCueSnapshot[] | null;
};

export type Project = {
  name: string;
  episodes: Episode[];
  createdAt: string;
};
