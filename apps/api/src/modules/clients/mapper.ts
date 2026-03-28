function digitsOnly(s: string): string {
  return s.replace(/\D/g, "");
}

function formatBrazilPhone(input: string): string {
  const d = digitsOnly(input).slice(0, 11);
  if (d.length === 0) return "";
  const ddd = d.slice(0, 2);
  const rest = d.slice(2);

  if (d.length <= 2) {
    return d.length === 1 ? `(${d}` : `(${ddd})`;
  }
  if (d.length <= 6) {
    return `(${ddd}) ${rest}`;
  }
  if (d.length === 11) {
    return `(${ddd}) ${rest.slice(0, 5)}-${rest.slice(5)}`;
  }
  return `(${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
}

type ClientLike = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  paymentMethod: "WIRE_TRANSFER" | "WISE" | null;
  country: string | null;
  notes: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: Date;
  updatedAt: Date;
  _count?: { projects: number };
};

export function serializeClient(c: ClientLike) {
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone ? formatBrazilPhone(c.phone) : null,
    paymentMethod: c.paymentMethod,
    country: c.country,
    notes: c.notes,
    status: c.status,
    projectCount: c._count?.projects,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}
