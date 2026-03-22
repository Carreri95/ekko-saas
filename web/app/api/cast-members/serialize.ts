import type { CastMember } from "@/app/generated/prisma/client";
import type { CastMemberDto } from "@/app/types/cast-member";
import { formatBrazilPhone } from "@/src/lib/phone-format";

export function serializeCastMember(m: CastMember): CastMemberDto {
  return {
    id: m.id,
    name: m.name,
    role: m.role,
    whatsapp: m.whatsapp ? formatBrazilPhone(m.whatsapp) : null,
    email: m.email,
    specialties: m.specialties,
    status: m.status,
    notes: m.notes,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}
