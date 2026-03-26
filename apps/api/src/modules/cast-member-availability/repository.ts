import type { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../infrastructure/db/prisma.client.js";

export type CastMemberAvailabilityRow =
  Prisma.CastMemberAvailabilityGetPayload<null>;

export class CastMemberAvailabilityRepository {
  findCastMemberById(castMemberId: string) {
    return prisma.castMember.findUnique({
      where: { id: castMemberId },
      select: { id: true },
    });
  }

  listByCastMember(castMemberId: string) {
    return prisma.castMemberAvailability.findMany({
      where: { castMemberId },
      orderBy: [{ startAt: "asc" }, { createdAt: "asc" }],
    });
  }

  findForCastMember(castMemberId: string, availabilityId: string) {
    return prisma.castMemberAvailability.findFirst({
      where: { id: availabilityId, castMemberId },
    });
  }

  create(data: Prisma.CastMemberAvailabilityUncheckedCreateInput) {
    return prisma.castMemberAvailability.create({ data });
  }

  update(availabilityId: string, data: Prisma.CastMemberAvailabilityUncheckedUpdateInput) {
    return prisma.castMemberAvailability.update({
      where: { id: availabilityId },
      data,
    });
  }

  delete(availabilityId: string) {
    return prisma.castMemberAvailability.delete({ where: { id: availabilityId } });
  }
}
