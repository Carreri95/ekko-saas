export type BatchJobRow = {
  id: string;
  status: "PENDING" | "RUNNING" | "DONE" | "FAILED";
  engine: string;
  language: string | null;
  originalFilename: string | null;
  exportFormat: string | null;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
};

export type BatchStatusPayload = {
  batchId: string;
  status: string;
  engine: string;
  total: number;
  done: number;
  failed: number;
  running: number;
  pending: number;
  jobs: BatchJobRow[];
};
