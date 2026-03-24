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
  notes: string | null;
  createdAt: string;
};
