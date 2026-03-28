import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/db/prisma.client.js";

export const communicationLogInclude = {
  dubbingProject: { select: { id: true, name: true } },
  episode: { select: { id: true, number: true, title: true } },
  castMember: { select: { id: true, name: true } },
  client: { select: { id: true, name: true } },
  session: { select: { id: true, title: true, startAt: true } },
} satisfies Prisma.CommunicationLogInclude;

export type CommunicationLogFull = Prisma.CommunicationLogGetPayload<{
  include: typeof communicationLogInclude;
}>;

export class CommunicationLogsRepository {
  findProjectById(projectId: string) {
    return prisma.dubbingProject.findUnique({ where: { id: projectId }, select: { id: true } });
  }

  findEpisodeInProject(projectId: string, episodeId: string) {
    return prisma.episode.findFirst({ where: { id: episodeId, projectId }, select: { id: true } });
  }

  findSessionInProject(projectId: string, sessionId: string) {
    return prisma.recordingSession.findFirst({ where: { id: sessionId, projectId }, select: { id: true } });
  }

  findSessionInProjectWithCast(projectId: string, sessionId: string) {
    return prisma.recordingSession.findFirst({
      where: { id: sessionId, projectId },
      select: {
        id: true,
        title: true,
        castMemberId: true,
        episodeId: true,
        castMember: {
          select: { id: true, name: true, email: true, whatsapp: true },
        },
      },
    });
  }

  findCastMemberById(castMemberId: string) {
    return prisma.castMember.findUnique({ where: { id: castMemberId }, select: { id: true } });
  }

  findClientById(clientId: string) {
    return prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
  }

  listByProject(projectId: string) {
    return prisma.communicationLog.findMany({
      where: { dubbingProjectId: projectId },
      include: communicationLogInclude,
      orderBy: [{ createdAt: "desc" }],
    });
  }

  findByCommunicationGroupId(projectId: string, communicationGroupId: string) {
    return prisma.communicationLog.findMany({
      where: { dubbingProjectId: projectId, communicationGroupId },
      include: communicationLogInclude,
      orderBy: [{ channel: "asc" }],
    });
  }

  findManyByIds(projectId: string, ids: string[]) {
    if (ids.length === 0) return Promise.resolve([] as CommunicationLogFull[]);
    return prisma.communicationLog.findMany({
      where: { dubbingProjectId: projectId, id: { in: ids } },
      include: communicationLogInclude,
    });
  }

  deleteMany(logIds: string[]) {
    if (logIds.length === 0) return Promise.resolve(0);
    return prisma.communicationLog.deleteMany({ where: { id: { in: logIds } } }).then((r) => r.count);
  }

  findInProject(projectId: string, logId: string) {
    return prisma.communicationLog.findFirst({
      where: { id: logId, dubbingProjectId: projectId },
      include: communicationLogInclude,
    });
  }

  create(data: Prisma.CommunicationLogUncheckedCreateInput) {
    return prisma.communicationLog.create({
      data,
      include: communicationLogInclude,
    });
  }

  createMany(dataList: Prisma.CommunicationLogUncheckedCreateInput[]) {
    if (dataList.length === 0) {
      return Promise.resolve([] as CommunicationLogFull[]);
    }
    return prisma.$transaction(async (tx) => {
      const out: CommunicationLogFull[] = [];
      for (const data of dataList) {
        const row = await tx.communicationLog.create({
          data,
          include: communicationLogInclude,
        });
        out.push(row);
      }
      return out;
    });
  }

  update(logId: string, data: Prisma.CommunicationLogUncheckedUpdateInput) {
    return prisma.communicationLog.update({
      where: { id: logId },
      data,
      include: communicationLogInclude,
    });
  }

  delete(logId: string) {
    return prisma.communicationLog.delete({ where: { id: logId } });
  }
}
