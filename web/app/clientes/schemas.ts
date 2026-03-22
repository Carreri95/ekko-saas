import { z } from "zod";

export const clientStatusEnum = z.enum(["ACTIVE", "INACTIVE"]);

export const clientFormSchema = z.object({
  name: z
    .string()
    .min(1, "Nome do cliente é obrigatório")
    .max(120, "Nome muito longo"),

  email: z.string().refine(
    (v) => v.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
    "E-mail inválido",
  ),

  phone: z.string().refine(
    (v) =>
      v.trim() === "" || /^[\d\s()+\-]{7,24}$/.test(v.trim()),
    "Telefone inválido",
  ),

  country: z.string().max(60, "País muito longo"),

  notes: z.string().max(2000, "Observações muito longas"),

  status: clientStatusEnum.default("ACTIVE"),
});

export type ClientFormInput = z.input<typeof clientFormSchema>;
export type ClientFormData = z.output<typeof clientFormSchema>;
