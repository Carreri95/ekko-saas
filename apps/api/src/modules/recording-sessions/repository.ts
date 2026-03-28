import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/db/prisma.client.js";

export const recordingSessionFullInclude = {
  castMember: { select: { id: true, name: true, role: true } },
  recordingTechnician: { select: { id: true, name: true, role: true } },
  sessionEpisodes: {
    orderBy: { episode: { number: "asc" as const } },
    include: {
      episode: { select: { id: true, number: true, title: true } },
    },
  },
  episode: { select: { id: true, number: true, title: true } },
} satisfies Prisma.RecordingSessionInclude;

export type RecordingSessionFull = Prisma.RecordingSessionGetPayload<{
  include: typeof recordingSessionFullInclude;
}>;

export class RecordingSessionsRepository {
  findProjectById(projectId: string) {
    return prisma.dubbingProject.findUnique({ where: { id: projectId }, select: { id: true } });
  }

  findCastMemberById(castMemberId: string) {
    return prisma.castMember.findUnique({ where: { id: castMemberId }, select: { id: true } });
  }

  findRecordingTechnicianById(recordingTechnicianId: string) {
    return prisma.collaborator.findFirst({
      where: { id: recordingTechnicianId, role: "RECORDING_TECHNICIAN" },
      select: { id: true },
    });
  }

  findEpisodeInProject(projectId: string, episodeId: string) {
    return prisma.episode.findFirst({ where: { id: episodeId, projectId }, select: { id: true } });
  }

  findCharacterInProject(projectId: string, characterId: string) {
    return prisma.projectCharacter.findFirst({ where: { id: characterId, projectId }, select: { id: true } });
  }

  listByProject(projectId: string) {
    return prisma.recordingSession.findMany({
      where: { projectId },
      include: recordingSessionFullInclude,
      orderBy: [{ startAt: "asc" }, { createdAt: "asc" }],
    });
  }

  findInProject(projectId: string, sessionId: string) {
    return prisma.recordingSession.findFirst({
      where: { id: sessionId, projectId },
      include: recordingSessionFullInclude,
    });
  }

  createWithEpisodes(
    data: Prisma.RecordingSessionUncheckedCreateInput,
    episodeIds: string[],
  ) {
    const uniq = [...new Set(episodeIds)];
    const episodeIdCol = uniq.length === 1 ? uniq[0]! : null;
    return prisma.$transaction(async (tx) => {
      const session = await tx.recordingSession.create({
        data: { ...data, episodeId: episodeIdCol },
      });
      if (uniq.length > 0) {
        await tx.recordingSessionEpisode.createMany({
          data: uniq.map((episodeId) => ({
            sessionId: session.id,
            episodeId,
          })),
        });
      }
      return tx.recordingSession.findFirstOrThrow({
        where: { id: session.id },
        include: recordingSessionFullInclude,
      });
    });
  }

  update(
    sessionId: string,
    data: Prisma.RecordingSessionUncheckedUpdateInput,
    options?: { replaceEpisodeIds?: string[] | undefined },
  ) {
    return prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.recordingSession.update({
          where: { id: sessionId },
          data,
        });
      }
      if (options?.replaceEpisodeIds !== undefined) {
        const uniq = [...new Set(options.replaceEpisodeIds)];
        await tx.recordingSessionEpisode.deleteMany({ where: { sessionId } });
        if (uniq.length > 0) {
          await tx.recordingSessionEpisode.createMany({
            data: uniq.map((episodeId) => ({
              sessionId,
              episodeId,
            })),
          });
        }
        await tx.recordingSession.update({
          where: { id: sessionId },
          data: { episodeId: uniq.length === 1 ? uniq[0]! : null },
        });
      }
      return tx.recordingSession.findFirstOrThrow({
        where: { id: sessionId },
        include: recordingSessionFullInclude,
      });
    });
  }

  delete(sessionId: string) {
    return prisma.recordingSession.delete({ where: { id: sessionId } });
  }
}
