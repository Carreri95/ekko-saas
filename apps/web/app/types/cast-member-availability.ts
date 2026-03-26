export type CastMemberAvailabilityType =
  | "AVAILABLE"
  | "UNAVAILABLE"
  | "BLOCKED";

export type CastMemberAvailabilityDto = {
  id: string;
  castMemberId: string;
  startAt: string;
  endAt: string;
  type: CastMemberAvailabilityType;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};
