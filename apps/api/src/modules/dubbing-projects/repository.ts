import { prisma } from "../../infrastructure/db/prisma.client.js";
import {
  EpisodeStatus,
  Prisma,
} from "../../generated/prisma/client.js";

export class DubbingProjectsRepository {
  count(where: object) {
    return prisma.dubbingProject.count({ where });
  }

  findMany(where: object, opts?: { skip?: number; take?: number }) {
    return prisma.dubbingProject.findMany({
      where,
      orderBy: [{ status: "asc" }, { deadline: "asc" }],
      ...(opts ?? {}),
    });
  }

  findMetricsRows(where: object) {
    return prisma.dubbingProject.findMany({
      where,
      select: {
        episodeCount: true,
        durationMin: true,
        value: true,
        valueCurrency: true,
        status: true,
        deadline: true,
      },
    });
  }

  findById(id: string) {
    return prisma.dubbingProject.findUnique({ where: { id } });
  }

  create(data: Record<string, unknown>) {
    return prisma.dubbingProject.create({
      data: data as Prisma.DubbingProjectCreateInput,
    });
  }

  /**
   * Cria o projeto e N linhas `Episode` (números 1..N) na mesma transação.
   */
  createProjectWithEpisodes(
    data: Record<string, unknown>,
    plannedEpisodeCount: number,
  ) {
    const n = Math.max(0, Math.floor(plannedEpisodeCount));
    return prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const project = await tx.dubbingProject.create({
        data: data as Prisma.DubbingProjectCreateInput,
      });
      if (n > 0) {
        await tx.episode.createMany({
          data: Array.from({ length: n }, (_, i) => ({
            projectId: project.id,
            number: i + 1,
            status: EpisodeStatus.PENDING,
          })),
        });
      }
      return project;
    });
  }

  findEpisodesByProjectId(projectId: string) {
    return prisma.episode.findMany({
      where: { projectId },
      orderBy: { number: "asc" },
    });
  }

  findEpisodeInProject(projectId: string, episodeId: string) {
    return prisma.episode.findFirst({
      where: { id: episodeId, projectId },
    });
  }

  updateEpisode(episodeId: string, data: Record<string, unknown>) {
    return prisma.episode.update({
      where: { id: episodeId },
      data,
    });
  }

  update(id: string, data: Record<string, unknown>) {
    return prisma.dubbingProject.update({ where: { id }, data });
  }

  delete(id: string) {
    return prisma.dubbingProject.delete({ where: { id } });
  }

  findProjectCharacters(projectId: string) {
    return prisma.projectCharacter.findMany({
      where: { projectId },
      include: { castMember: { select: { id: true, name: true, role: true } } },
      orderBy: [{ importance: "asc" }, { name: "asc" }],
    });
  }

  createProjectCharacter(projectId: string, data: Record<string, unknown>) {
    return prisma.projectCharacter.create({
      data: { ...data, projectId } as Prisma.ProjectCharacterUncheckedCreateInput,
      include: { castMember: { select: { id: true, name: true, role: true } } },
    });
  }

  findCharacterInProject(projectId: string, charId: string) {
    return prisma.projectCharacter.findFirst({
      where: { id: charId, projectId },
    });
  }

  updateCharacter(charId: string, data: Record<string, unknown>) {
    return prisma.projectCharacter.update({
      where: { id: charId },
      data,
      include: { castMember: { select: { id: true, name: true, role: true } } },
    });
  }

  deleteCharacter(charId: string) {
    return prisma.projectCharacter.delete({ where: { id: charId } });
  }

  findProjectCharacterMemberIds(projectId: string) {
    return prisma.projectCharacter.findMany({
      where: { projectId, castMemberId: { not: null } },
      select: { castMemberId: true },
    });
  }
}
