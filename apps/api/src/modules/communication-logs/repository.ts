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
