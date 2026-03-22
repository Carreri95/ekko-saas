import type { Client } from "@/app/generated/prisma/client";
import type { ClientDto } from "@/app/types/client";
import { formatBrazilPhone } from "@/src/lib/phone-format";

export function serializeClient(
  c: Client & { _count?: { projects: number } },
): ClientDto {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone ? formatBrazilPhone(c.phone) : null,
    country: c.country,
    notes: c.notes,
    status: c.status,
    projectCount: c._count?.projects,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}
