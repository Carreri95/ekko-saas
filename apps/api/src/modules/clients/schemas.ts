import { z } from "zod";

export const clientStatusEnum = z.enum(["ACTIVE", "INACTIVE"]);

export const clientFormSchema = z.object({
  name: z.string().min(1).max(120),
  email: z
    .string()
    .refine(
      (v) => v.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
      "E-mail invalido",
    ),
  phone: z
    .string()
    .refine(
      (v) => v.trim() === "" || /^[\d\s()+\-]{7,24}$/.test(v.trim()),
      "Telefone invalido",
    ),
  country: z.string().max(60),
  notes: z.string().max(2000),
  status: clientStatusEnum.default("ACTIVE"),
});

export const clientPatchSchema = clientFormSchema.partial();

export type ClientFormData = z.output<typeof clientFormSchema>;
export type ClientPatchData = z.output<typeof clientPatchSchema>;
