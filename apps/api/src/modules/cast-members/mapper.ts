function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function formatBrazilPhone(input: string): string {
  const d = digitsOnly(input).slice(0, 11);
  if (d.length === 0) return "";
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);
  if (d.length <= 2) return d.length === 1 ? `(${d}` : `(${ddd})`;
  if (d.length <= 6) return `(${ddd}) ${rest}`;
  if (d.length === 11) return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}

type CastMemberLike = {
  id: string;
  name: string;
  role: string | null;
  whatsapp: string | null;
  email: string | null;
  preferredCommunicationChannel: "EMAIL" | "WHATSAPP" | null;
  specialties: string[];
  status: "AVAILABLE" | "BUSY" | "INACTIVE";
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeCastMember(member: CastMemberLike, activeProjectCount = 0) {
  return {
    id: member.id,
    name: member.name,
    role: member.role,
    whatsapp: member.whatsapp ? formatBrazilPhone(member.whatsapp) : null,
    email: member.email,
    preferredCommunicationChannel: member.preferredCommunicationChannel,
    specialties: member.specialties,
    status: member.status,
    notes: member.notes,
    createdAt: member.createdAt.toISOString(),
    updatedAt: member.updatedAt.toISOString(),
    activeProjectCount,
  };
}
