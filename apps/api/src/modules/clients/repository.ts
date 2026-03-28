import { prisma } from "../../infrastructure/db/prisma.client.js";

export class ClientsRepository {
  async count(where: object) {
    return prisma.client.count({ where });
  }

  async findMany(where: object, opts?: { skip?: number; take?: number }) {
    return prisma.client.findMany({
      where,
      include: { _count: { select: { projects: true } } },
      orderBy: { name: "asc" },
      ...(opts ?? {}),
    });
  }

  async findById(id: string) {
    return prisma.client.findUnique({
      where: { id },
      include: { _count: { select: { projects: true } } },
    });
  }

  async findByEmail(email: string, exceptId?: string) {
    return prisma.client.findFirst({
      where: {
        email,
        ...(exceptId ? { NOT: { id: exceptId } } : {}),
      },
      select: { id: true },
    });
  }

  async findByPhone(phone: string, exceptId?: string) {
    return prisma.client.findFirst({
      where: {
        phone,
        ...(exceptId ? { NOT: { id: exceptId } } : {}),
      },
      select: { id: true },
    });
  }

  async create(data: {
    name: string;
    email: string | null;
    phone: string | null;
    paymentMethod: "WIRE_TRANSFER" | "WISE" | null;
    country: string | null;
    notes: string | null;
    status: "ACTIVE" | "INACTIVE";
  }) {
    return prisma.client.create({
      data,
      include: { _count: { select: { projects: true } } },
    });
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      email: string | null;
      phone: string | null;
      paymentMethod: "WIRE_TRANSFER" | "WISE" | null;
      country: string | null;
      notes: string | null;
      status: "ACTIVE" | "INACTIVE";
    }>,
  ) {
    return prisma.client.update({
      where: { id },
      data,
      include: { _count: { select: { projects: true } } },
    });
  }

  async delete(id: string) {
    return prisma.client.delete({ where: { id } });
  }

  async listProjectValues() {
    return prisma.dubbingProject.findMany({
      select: { value: true, valueCurrency: true },
    });
  }
}
