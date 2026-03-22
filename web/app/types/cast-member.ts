export type CastMemberDto = {
  id: string;
  name: string;
  role: string | null;
  whatsapp: string | null;
  email: string | null;
  specialties: string[];
  status: "AVAILABLE" | "BUSY" | "INACTIVE";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};
