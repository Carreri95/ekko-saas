import { prisma } from "../../lib/prisma";

import { BatchJobService } from "./batch-job.service";
import { MediaStorageService } from "./media-storage.service";
import { TranscriptionJobService } from "./transcription-job.service";

export function getMediaStorageService(): MediaStorageService {
  return new MediaStorageService();
}

export function getTranscriptionJobService(): TranscriptionJobService {
  return new TranscriptionJobService(prisma, getMediaStorageService());
}

export function getBatchJobService(): BatchJobService {
  return new BatchJobService(
    prisma,
    getMediaStorageService(),
    getTranscriptionJobService(),
  );
}
