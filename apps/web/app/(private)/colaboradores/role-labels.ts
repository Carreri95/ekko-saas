import type { CollaboratorRole } from "@/app/types/collaborator";

export const COLLABORATOR_ROLE_LABEL: Record<CollaboratorRole, string> = {
  RECORDING_TECHNICIAN: "Técnico de gravação",
  POST_PRODUCTION: "Pós-produção",
  MIXER: "Mixer",
  PRE_PRODUCTION: "Pré-produção",
};
