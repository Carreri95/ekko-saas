export type ClientDto = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  country: string | null;
  notes: string | null;
  status: "ACTIVE" | "INACTIVE";
  projectCount?: number;
  createdAt: string;
  updatedAt: string;
};
