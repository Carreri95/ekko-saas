import type { Prisma, PrismaClient } from "../../../api/src/generated/prisma/client.js";

import type { NormalizedCue } from "./types.js";

export class CueRepository {
  constructor(private readonly db: PrismaClient | Prisma.TransactionClient) {}

  async deleteByJob(jobId: string): Promise<void> {
    await this.db.subtitleCue.deleteMany({
      where: { transcriptionJobId: jobId },
    });
  }

  /**
   * Substitui todas as cues do arquivo por um lote gerado por transcrição.
   * Deve ser chamado dentro de uma transação do Prisma quando o caller já abriu `tx`.
   */
  async saveBatchForTranscription(params: {
    subtitleFileId: string;
    jobId: string;
    cues: NormalizedCue[];
  }): Promise<void> {
    const { subtitleFileId, jobId, cues } = params;

    await this.db.subtitleCue.deleteMany({ where: { subtitleFileId } });

    if (cues.length === 0) return;

    await this.db.subtitleCue.createMany({
      data: cues.map((c, i) => ({
        subtitleFileId,
        transcriptionJobId: jobId,
        cueIndex: i + 1,
        startMs: c.startMs,
        endMs: c.endMs,
        text: c.text,
      })),
    });
  }
}
