import { prisma } from "../../infrastructure/db/prisma.client.js";

export class CollaboratorsRepository {
  count(where: object) {
    return prisma.collaborator.count({ where });
  }

  groupByRole(where: object) {
    return prisma.collaborator.groupBy({
      by: ["role"],
      where,
      _count: { _all: true },
    });
  }

  findMany(where: object, opts?: { skip?: number; take?: number }) {
    return prisma.collaborator.findMany({
      where,
      orderBy: { name: "asc" },
      ...(opts ?? {}),
    });
  }

  findById(id: string) {
    return prisma.collaborator.findUnique({ where: { id } });
  }

  findByEmail(email: string, exceptId?: string) {
    return prisma.collaborator.findFirst({
      where: {
        email,
        ...(exceptId ? { NOT: { id: exceptId } } : {}),
      },
      select: { id: true },
    });
  }

  findByWhatsapp(whatsapp: string, exceptId?: string) {
    return prisma.collaborator.findFirst({
      where: {
        whatsapp,
        ...(exceptId ? { NOT: { id: exceptId } } : {}),
      },
      select: { id: true },
    });
  }

  create(data: {
    name: string;
    cpf: string | null;
    cnpj: string | null;
    razaoSocial: string | null;
    role: "RECORDING_TECHNICIAN" | "POST_PRODUCTION" | "MIXER" | "PRE_PRODUCTION";
    email: string | null;
    whatsapp: string | null;
    prefersEmail: boolean;
    prefersWhatsapp: boolean;
  }) {
    return prisma.collaborator.create({ data });
  }

  update(
    id: string,
    data: Partial<{
      name: string;
      cpf: string | null;
      cnpj: string | null;
      razaoSocial: string | null;
      role: "RECORDING_TECHNICIAN" | "POST_PRODUCTION" | "MIXER" | "PRE_PRODUCTION";
      email: string | null;
      whatsapp: string | null;
      prefersEmail: boolean;
      prefersWhatsapp: boolean;
    }>,
  ) {
    return prisma.collaborator.update({ where: { id }, data });
  }

  delete(id: string) {
    return prisma.collaborator.delete({ where: { id } });
  }
}
