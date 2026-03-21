import type { MediaKind, PrismaClient } from "../../../app/generated/prisma/client";

export class ProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string) {
    return this.prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        storageKey: true,
        mediaKind: true,
        durationMs: true,
        userId: true,
      },
    });
  }

  async updateMedia(params: {
    projectId: string;
    storageKey: string;
    mediaKind: MediaKind;
    durationMs?: number | null;
  }) {
    return this.prisma.project.update({
      where: { id: params.projectId },
      data: {
        storageKey: params.storageKey,
        mediaKind: params.mediaKind,
        durationMs: params.durationMs ?? undefined,
      },
      select: { id: true, storageKey: true, mediaKind: true, durationMs: true },
    });
  }
}
