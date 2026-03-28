export type ClientDto = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  paymentMethod: "WIRE_TRANSFER" | "WISE" | null;
  country: string | null;
  notes: string | null;
  status: "ACTIVE" | "INACTIVE";
  projectCount?: number;
  createdAt: string;
  updatedAt: string;
};
