import { prisma } from "../../infrastructure/db/prisma.client.js";

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
        episodes: true,
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
    return prisma.dubbingProject.create({ data });
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
      data: { ...data, projectId },
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
