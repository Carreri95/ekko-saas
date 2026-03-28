import { z } from "zod";
import { digitsOnly } from "@/src/lib/document-format";

export const clientStatusEnum = z.enum(["ACTIVE", "INACTIVE"]);
export const clientPaymentMethodEnum = z.enum(["WIRE_TRANSFER", "WISE"]);

const clientEmailField = z
  .string()
  .trim()
  .min(1, "E-mail é obrigatório")
  .email("E-mail inválido")
  .transform((s) => s.toLowerCase());

const clientPhoneField = z
  .string()
  .transform((s) => digitsOnly(s))
  .refine((d) => d.length >= 10 && d.length <= 11, {
    message: "Telefone é obrigatório (DDD + número, 10 ou 11 dígitos)",
  });

const clientCountryField = z
  .string()
  .trim()
  .min(1, "País é obrigatório")
  .max(60, "País muito longo");

export const clientFormSchema = z.object({
  name: z
    .string()
    .min(1, "Nome do cliente é obrigatório")
    .max(120, "Nome muito longo"),

  email: clientEmailField,
  phone: clientPhoneField,
  country: clientCountryField,

  notes: z.string().max(2000, "Observações muito longas"),

  status: clientStatusEnum.default("ACTIVE"),
  paymentMethod: clientPaymentMethodEnum,
});

export type ClientFormInput = z.input<typeof clientFormSchema>;
export type ClientFormData = z.output<typeof clientFormSchema>;
