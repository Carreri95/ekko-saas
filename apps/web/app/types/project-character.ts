export type ProjectCharacterAssignmentDto = {
  id: string;
  projectId: string;
  characterId: string;
  castMemberId: string;
  type: "TEST_OPTION_1" | "TEST_OPTION_2" | "PRINCIPAL" | "RESERVE" | "SUPPORT";
  status: "INVITED" | "TEST_SENT" | "TEST_RECEIVED" | "APPROVED" | "CAST" | "REPLACED" | "DECLINED";
  priority: number;
  approvedByClient: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  castMember: {
    id: string;
    name: string;
    role: string | null;
  } | null;
};

export type ProjectCharacterDto = {
  id: string;
  projectId: string;
  name: string;
  type: string | null;
  voiceType: string | null;
  importance: "MAIN" | "SUPPORT" | "EXTRA";
  castMemberId: string | null;
  castMember: {
    id: string;
    name: string;
    role: string | null;
  } | null;
  assignments: ProjectCharacterAssignmentDto[];
  notes: string | null;
  createdAt: string;
};
