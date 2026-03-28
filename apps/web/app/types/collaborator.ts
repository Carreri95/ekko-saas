export type CollaboratorRole =
  | "RECORDING_TECHNICIAN"
  | "POST_PRODUCTION"
  | "MIXER"
  | "PRE_PRODUCTION";

export type CollaboratorDto = {
  id: string;
  name: string;
  cpf: string | null;
  cnpj: string | null;
  razaoSocial: string | null;
  role: CollaboratorRole;
  email: string | null;
  whatsapp: string | null;
  prefersEmail: boolean;
  prefersWhatsapp: boolean;
  createdAt: string;
  updatedAt: string;
};
