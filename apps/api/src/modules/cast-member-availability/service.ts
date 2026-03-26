import type { Prisma } from "../../generated/prisma/client.js";
import { serializeCastMemberAvailability } from "./mapper.js";
import type {
  CastMemberAvailabilityCreateData,
  CastMemberAvailabilityPatchData,
} from "./schemas.js";
import { CastMemberAvailabilityRepository } from "./repository.js";

function normalizeNotes(notes: string | null | undefined): string | null | undefined {
  if (notes === undefined) return undefined;
  if (notes === null) return null;
  const trimmed = String(notes).trim();
  return trimmed ? trimmed : null;
}

function parseIso(value: string, field: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { badRequest: { error: `${field} inválido` } as const };
  }
  return { ok: date };
}

export class CastMemberAvailabilityService {
  constructor(private readonly repo = new CastMemberAvailabilityRepository()) {}

  async list(castMemberId: string) {
    const member = await this.repo.findCastMemberById(castMemberId);
    if (!member) return { notFound: true as const };
    const rows = await this.repo.listByCastMember(castMemberId);
    return { availabilities: rows.map(serializeCastMemberAvailability) };
  }

  async create(castMemberId: string, input: CastMemberAvailabilityCreateData) {
    const member = await this.repo.findCastMemberById(castMemberId);
    if (!member) return { notFound: true as const };

    const ps = parseIso(input.startAt, "startAt");
    if ("badRequest" in ps) return ps;
    const pe = parseIso(input.endAt, "endAt");
    if ("badRequest" in pe) return pe;
    if (ps.ok! >= pe.ok!) {
      return { badRequest: { error: "startAt deve ser anterior a endAt" } as const };
    }

    const row = await this.repo.create({
      castMemberId,
      startAt: ps.ok!,
      endAt: pe.ok!,
      type: input.type,
      notes: normalizeNotes(input.notes) ?? null,
    });
    return { availability: serializeCastMemberAvailability(row) };
  }

  async patch(
    castMemberId: string,
    availabilityId: string,
    input: CastMemberAvailabilityPatchData,
  ) {
    const existing = await this.repo.findForCastMember(castMemberId, availabilityId);
    if (!existing) return { notFound: true as const };

    let startAt = existing.startAt;
    let endAt = existing.endAt;

    if (input.startAt !== undefined) {
      const p = parseIso(input.startAt, "startAt");
      if ("badRequest" in p) return p;
      startAt = p.ok!;
    }
    if (input.endAt !== undefined) {
      const p = parseIso(input.endAt, "endAt");
      if ("badRequest" in p) return p;
      endAt = p.ok!;
    }
    if (startAt >= endAt) {
      return { badRequest: { error: "startAt deve ser anterior a endAt" } as const };
    }

    const data: Prisma.CastMemberAvailabilityUncheckedUpdateInput = {};
    if (input.startAt !== undefined) data.startAt = startAt;
    if (input.endAt !== undefined) data.endAt = endAt;
    if (input.type !== undefined) data.type = input.type;
    if (input.notes !== undefined) data.notes = normalizeNotes(input.notes) ?? null;

    const row = await this.repo.update(availabilityId, data);
    return { availability: serializeCastMemberAvailability(row) };
  }

  async remove(castMemberId: string, availabilityId: string) {
    const existing = await this.repo.findForCastMember(castMemberId, availabilityId);
    if (!existing) return { notFound: true as const };
    await this.repo.delete(availabilityId);
    return { ok: true as const };
  }
}
