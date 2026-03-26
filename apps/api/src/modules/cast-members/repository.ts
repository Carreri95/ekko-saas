import { prisma } from "../../infrastructure/db/prisma.client.js";

export class CastMembersRepository {
  count(where: object) {
    return prisma.castMember.count({ where });
  }

  findMany(where: object, opts?: { skip?: number; take?: number }) {
    return prisma.castMember.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        characterAssignments: {
          where: {
            project: {
              status: {
                notIn: ["DONE", "PAUSED"] as Array<"DONE" | "PAUSED">,
              },
            },
          },
          select: { projectId: true },
        },
      },
      ...(opts ?? {}),
    });
  }

  listSpecialties(where: object) {
    return prisma.castMember.findMany({
      where,
      select: { specialties: true },
    });
  }

  findById(id: string) {
    return prisma.castMember.findUnique({ where: { id } });
  }

  findByEmail(email: string, exceptId?: string) {
    return prisma.castMember.findFirst({
      where: {
        email,
        ...(exceptId ? { NOT: { id: exceptId } } : {}),
      },
      select: { id: true },
    });
  }

  findByWhatsapp(whatsapp: string, exceptId?: string) {
    return prisma.castMember.findFirst({
      where: {
        whatsapp,
        ...(exceptId ? { NOT: { id: exceptId } } : {}),
      },
      select: { id: true },
    });
  }

  create(data: {
    name: string;
    role: string | null;
    whatsapp: string | null;
    email: string | null;
    specialties: string[];
    status: "AVAILABLE" | "BUSY" | "INACTIVE";
    notes: string | null;
  }) {
    return prisma.castMember.create({ data });
  }

  update(
    id: string,
    data: Partial<{
      name: string;
      role: string | null;
      whatsapp: string | null;
      email: string | null;
      specialties: string[];
      status: "AVAILABLE" | "BUSY" | "INACTIVE";
      notes: string | null;
    }>,
  ) {
    return prisma.castMember.update({ where: { id }, data });
  }

  delete(id: string) {
    return prisma.castMember.delete({ where: { id } });
  }

  groupActiveProjectsByCastMember(castMemberIds: string[]) {
    return prisma.projectCharacterAssignment.groupBy({
      by: ["castMemberId"],
      where: {
        castMemberId: { in: castMemberIds },
        project: { status: { notIn: ["DONE", "PAUSED"] } },
      },
      _count: { _all: true },
    });
  }

  updateManyStatus(ids: string[], status: "AVAILABLE" | "BUSY" | "INACTIVE") {
    return prisma.castMember.updateMany({
      where: {
        id: { in: ids },
        status: { not: "INACTIVE" },
      },
      data: { status },
    });
  }

  findCastings(castMemberId: string) {
    return prisma.projectCharacterAssignment.findMany({
      where: { castMemberId },
      include: {
        character: {
          select: {
            id: true,
            name: true,
            voiceType: true,
            importance: true,
          },
        },
        project: {
          select: {
            id: true,
            name: true,
            status: true,
            deadline: true,
            client: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }
}
