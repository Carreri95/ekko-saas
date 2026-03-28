import { z } from "zod";
import { digitsOnly } from "../../lib/zod-documents.js";

export const clientStatusEnum = z.enum(["ACTIVE", "INACTIVE"]);
export const clientPaymentMethodEnum = z.enum(["WIRE_TRANSFER", "WISE"]);

const clientEmailField = z
  .string()
  .trim()
  .min(1, "E-mail é obrigatório")
  .email("E-mail inválido")
  .transform((s) => s.toLowerCase());

/** Telefone BR: DDD + número (10 ou 11 dígitos), alinhado ao `normalizePhoneForStorage` da API. */
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
  name: z.string().min(1, "Nome é obrigatório").max(120, "Nome muito longo"),
  email: clientEmailField,
  phone: clientPhoneField,
  country: clientCountryField,
  notes: z.string().max(2000, "Observações muito longas"),
  status: clientStatusEnum.default("ACTIVE"),
  paymentMethod: clientPaymentMethodEnum,
});

export const clientPatchSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    email: clientEmailField.optional(),
    phone: clientPhoneField.optional(),
    country: clientCountryField.optional(),
    notes: z.string().max(2000).optional(),
    status: clientStatusEnum.optional(),
    paymentMethod: clientPaymentMethodEnum.optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe ao menos um campo para atualização",
  });

export type ClientFormData = z.output<typeof clientFormSchema>;
export type ClientPatchData = z.output<typeof clientPatchSchema>;
