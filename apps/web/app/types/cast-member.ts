/**
 * Dublador (`CastMember`).
 *
 * **INACTIVE** é o único `status` controlado manualmente (aba Informações).
 * **AVAILABLE** e **BUSY** são persistidos no banco e atualizados por
 * `syncCastMemberStatus` (vínculos de personagem e mudança de status de projeto).
 *
 * `activeProjectCount` (listagem) conta projetos de dublagem únicos em que há
 * personagem e o projeto não está DONE nem PAUSED.
 */
export type CastMemberDto = {
  id: string;
  name: string;
  role: string | null;
  whatsapp: string | null;
  email: string | null;
  preferredCommunicationChannel: "EMAIL" | "WHATSAPP" | null;
  specialties: string[];
  status: "AVAILABLE" | "BUSY" | "INACTIVE";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  activeProjectCount?: number;
};

export type CastMemberCastingDto = {
  characterId: string;
  characterName: string;
  voiceType: string | null;
  importance: "MAIN" | "SUPPORT" | "EXTRA";
  projectId: string;
  projectName: string;
  projectStatus: string;
  projectClient: string | null;
  projectDeadline: string | null;
  isActive: boolean;
};
