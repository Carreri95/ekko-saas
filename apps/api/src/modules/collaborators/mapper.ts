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

type CollaboratorLike = {
  id: string;
  name: string;
  cpf: string | null;
  cnpj: string | null;
  razaoSocial: string | null;
  role: "RECORDING_TECHNICIAN" | "POST_PRODUCTION" | "MIXER" | "PRE_PRODUCTION";
  email: string | null;
  whatsapp: string | null;
  prefersEmail: boolean;
  prefersWhatsapp: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export function serializeCollaborator(collaborator: CollaboratorLike) {
  return {
    id: collaborator.id,
    name: collaborator.name,
    cpf: collaborator.cpf,
    cnpj: collaborator.cnpj,
    razaoSocial: collaborator.razaoSocial,
    role: collaborator.role,
    email: collaborator.email,
    whatsapp: collaborator.whatsapp ? formatBrazilPhone(collaborator.whatsapp) : null,
    prefersEmail: collaborator.prefersEmail,
    prefersWhatsapp: collaborator.prefersWhatsapp,
    createdAt: collaborator.createdAt.toISOString(),
    updatedAt: collaborator.updatedAt.toISOString(),
  };
}
