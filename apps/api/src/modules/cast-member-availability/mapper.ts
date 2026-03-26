import type { CastMemberAvailabilityType } from "../../generated/prisma/client.js";
import type { CastMemberAvailabilityRow } from "./repository.js";

export function serializeCastMemberAvailability(row: CastMemberAvailabilityRow) {
  return {
    id: row.id,
    castMemberId: row.castMemberId,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    type: row.type as CastMemberAvailabilityType,
    notes: row.notes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
