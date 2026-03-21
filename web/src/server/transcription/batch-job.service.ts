import { unlink } from "node:fs/promises";

import type { PrismaClient } from "../../../app/generated/prisma/client";
import {
  BatchJobStatus,
  MediaKind,
  TranscriptionEngine,
  TranscriptionJobStatus,
} from "../../../app/generated/prisma/client";

import { getAudioDurationMsFromBuffer } from "./audio-duration";
import { MediaStorageService } from "./media-storage.service";
import { TranscriptionJobService } from "./transcription-job.service";

export class BatchJobService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly media: MediaStorageService,
    private readonly jobs: TranscriptionJobService,
  ) {}

  async createBatch(userId: string) {
    const batch = await this.prisma.batchJob.create({
      data: {
        userId,
        status: BatchJobStatus.PENDING,
        engine: TranscriptionEngine.OPENAI_WHISPER,
      },
      select: { id: true },
    });
    return batch;
  }

  async addFileFromUpload(params: {
    batchId: string;
    buffer: Buffer;
    mimeType: string;
    originalFilename: string;
    engine: TranscriptionEngine;
    language?: string | null;
    exportFormat: string;
  }) {
    const batch = await this.prisma.batchJob.findUnique({
      where: { id: params.batchId },
      select: { id: true, status: true, userId: true },
    });
    if (!batch) {
      throw new Error("Batch nao encontrado");
    }
    if (batch.status !== BatchJobStatus.PENDING) {
      throw new Error("Batch nao aceita mais ficheiros neste estado");
    }

    const project = await this.prisma.project.create({
      data: {
        userId: batch.userId,
        name: params.originalFilename.slice(0, 120),
      },
      select: { id: true },
    });

    const saved = await this.media.saveFile({
      buffer: params.buffer,
      mimeType: params.mimeType,
      originalFilename: params.originalFilename,
    });

    const durationMs = await getAudioDurationMsFromBuffer(
      params.buffer,
      params.mimeType,
    );

    await this.prisma.project.update({
      where: { id: project.id },
      data: {
        storageKey: saved.storageKey,
        mediaKind: MediaKind.audio,
        durationMs: durationMs ?? null,
      },
    });

    const publicPath = `/uploads/media/${saved.storageKey}`;

    const subtitleFile = await this.prisma.subtitleFile.create({
      data: {
        projectId: project.id,
        filename: params.originalFilename,
        wavFilename: params.originalFilename,
        wavPath: publicPath,
      },
      select: { id: true },
    });

    const job = await this.jobs.createAndEnqueue({
      projectId: project.id,
      subtitleFileId: subtitleFile.id,
      engine: params.engine,
      language: params.language ?? null,
      enqueue: false,
      batchId: params.batchId,
      originalFilename: params.originalFilename,
      exportFormat: params.exportFormat,
    });

    await this.prisma.batchJob.update({
      where: { id: params.batchId },
      data: { totalFiles: { increment: 1 } },
    });

    return { jobId: job.id, projectId: project.id };
  }

  /**
   * Processa todos os jobs PENDING do batch em sequência (MVP).
   * Erros por job não cancelam os seguintes.
   */
  async processBatchSequential(
    batchId: string,
    openaiApiKey?: string,
  ): Promise<void> {
    const batch = await this.prisma.batchJob.findUnique({
      where: { id: batchId },
      select: { id: true, status: true },
    });
    if (!batch) return;
    if (batch.status !== BatchJobStatus.PENDING) {
      return;
    }

    await this.prisma.batchJob.update({
      where: { id: batchId },
      data: { status: BatchJobStatus.RUNNING },
    });

    const pending = await this.prisma.transcriptionJob.findMany({
      where: { batchId, status: TranscriptionJobStatus.PENDING },
      orderBy: { createdAt: "asc" },
      select: { id: true, language: true, engine: true },
    });

    for (const j of pending) {
      await this.jobs.runJobToCompletion(j.id, {
        language: j.language ?? undefined,
        openaiApiKey:
          j.engine === TranscriptionEngine.OPENAI_WHISPER
            ? openaiApiKey
            : undefined,
      });
    }

    await this.prisma.batchJob.update({
      where: { id: batchId },
      data: {
        status: BatchJobStatus.DONE,
        completedAt: new Date(),
      },
    });
  }

  async getBatchStatus(batchId: string) {
    const batch = await this.prisma.batchJob.findUnique({
      where: { id: batchId },
      select: {
        id: true,
        status: true,
        engine: true,
        totalFiles: true,
        createdAt: true,
        completedAt: true,
      },
    });
    if (!batch) return null;

    const jobs = await this.prisma.transcriptionJob.findMany({
      where: { batchId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        status: true,
        engine: true,
        language: true,
        originalFilename: true,
        exportFormat: true,
        errorMessage: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
      },
    });

    let done = 0;
    let failed = 0;
    let running = 0;
    let pending = 0;
    for (const j of jobs) {
      if (j.status === TranscriptionJobStatus.DONE) done += 1;
      else if (j.status === TranscriptionJobStatus.FAILED) failed += 1;
      else if (j.status === TranscriptionJobStatus.RUNNING) running += 1;
      else pending += 1;
    }

    return {
      batchId: batch.id,
      status: batch.status,
      engine: batch.engine,
      total: jobs.length,
      done,
      failed,
      running,
      pending,
      jobs,
    };
  }

  async buildZipForDoneJobs(batchId: string): Promise<Buffer> {
    const AdmZip = (await import("adm-zip")).default;

    const batch = await this.prisma.batchJob.findUnique({
      where: { id: batchId },
      select: { id: true },
    });
    if (!batch) {
      throw new Error("Batch nao encontrado");
    }

    const doneJobs = await this.prisma.transcriptionJob.findMany({
      where: { batchId, status: TranscriptionJobStatus.DONE },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        originalFilename: true,
        subtitleFileId: true,
        exportFormat: true,
      },
    });

    if (doneJobs.length === 0) {
      throw new Error("Nenhum job concluido para exportar");
    }

    const zip = new AdmZip();
    const { formatSrt } = await import("../../lib/srt/format-srt");

    for (const job of doneJobs) {
      const fmt = (job.exportFormat ?? "SRT").toUpperCase();
      if (fmt !== "SRT") {
        continue;
      }

      const cues = await this.prisma.subtitleCue.findMany({
        where: { subtitleFileId: job.subtitleFileId },
        orderBy: { cueIndex: "asc" },
        select: {
          cueIndex: true,
          startMs: true,
          endMs: true,
          text: true,
        },
      });

      const srtBody = formatSrt(cues);
      const base =
        (job.originalFilename ?? "legenda").replace(/\.[^/.]+$/, "") ||
        `job-${job.id.slice(0, 8)}`;
      const safeName = `${base.replace(/[^\w\-._]+/g, "_")}.srt`;
      zip.addFile(safeName, Buffer.from(srtBody, "utf8"));
    }

    return zip.toBuffer();
  }

  /**
   * Remove jobs do lote (só PENDING ou FAILED). Apaga projeto, ficheiro em disco e cues.
   */
  async removeJobsFromBatch(
    batchId: string,
    jobIds: string[],
  ): Promise<{ removed: number; skipped: number }> {
    const unique = [...new Set(jobIds)].filter(Boolean);
    if (unique.length === 0) {
      return { removed: 0, skipped: 0 };
    }

    const batch = await this.prisma.batchJob.findUnique({
      where: { id: batchId },
      select: { id: true, totalFiles: true },
    });
    if (!batch) {
      throw new Error("Batch nao encontrado");
    }

    const jobs = await this.prisma.transcriptionJob.findMany({
      where: { id: { in: unique }, batchId },
      select: {
        id: true,
        projectId: true,
        status: true,
        project: { select: { storageKey: true } },
      },
    });

    const toRemove = jobs.filter(
      (j) =>
        j.status === TranscriptionJobStatus.PENDING ||
        j.status === TranscriptionJobStatus.FAILED,
    );

    await this.prisma.$transaction(async (tx) => {
      for (const j of toRemove) {
        const key = j.project.storageKey;
        if (key) {
          const abs = this.media.resolveAbsolutePath(key);
          await unlink(abs).catch(() => {});
        }
        await tx.project.delete({ where: { id: j.projectId } });
      }

      const dec = toRemove.length;
      if (dec > 0) {
        const nextTotal = Math.max(0, (batch.totalFiles ?? 0) - dec);
        await tx.batchJob.update({
          where: { id: batchId },
          data: { totalFiles: nextTotal },
        });
      }
    });

    const removed = toRemove.length;
    const skipped = unique.length - removed;
    return { removed, skipped };
  }
}
