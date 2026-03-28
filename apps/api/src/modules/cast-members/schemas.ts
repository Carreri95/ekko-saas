import { z } from "zod";
import { digitsOnly, zodCnpjDigits, zodCpfDigits } from "../../lib/zod-documents.js";

/** DDD + número BR (10 ou 11 dígitos), persistido só com dígitos. */
const zodCastMemberWhatsappDigits = z
  .string()
  .transform((s) => digitsOnly(s))
  .refine((d) => d.length >= 10 && d.length <= 11, {
    message: "WhatsApp é obrigatório (DDD + número, 10 ou 11 dígitos)",
  });

const zodCastMemberEmail = z
  .string()
  .trim()
  .min(1, "E-mail é obrigatório")
  .email("E-mail inválido")
  .transform((s) => s.toLowerCase());

const castMemberBaseFields = {
  name: z.string().min(1, "Nome completo é obrigatório").max(120, "Nome muito longo"),
  cpf: zodCpfDigits,
  cnpj: zodCnpjDigits,
  razaoSocial: z
    .string()
    .trim()
    .min(1, "Razão social é obrigatória")
    .max(160, "Razão social muito longa"),
  whatsapp: zodCastMemberWhatsappDigits,
  email: zodCastMemberEmail,
  /** Política fixa para dublador: ambos os canais ativos (não editável na UI). */
  prefersEmail: z.literal(true),
  prefersWhatsapp: z.literal(true),
  specialties: z
    .array(z.string().min(1))
    .min(1, "Adicione pelo menos uma especialidade")
    .max(10, "Máximo de 10 especialidades"),
  manualInactive: z.boolean(),
  notes: z.string(),
};

export const castMemberFormSchema = z.object(castMemberBaseFields);

const patchEmail = z
  .string()
  .trim()
  .min(1, "E-mail é obrigatório")
  .email("E-mail inválido")
  .transform((s) => s.toLowerCase());

const patchWhatsapp = z
  .string()
  .transform((s) => digitsOnly(s))
  .refine((d) => d.length >= 10 && d.length <= 11, {
    message: "WhatsApp é obrigatório (DDD + número, 10 ou 11 dígitos)",
  });

export const castMemberPatchSchema = z
  .object({
    name: castMemberBaseFields.name.optional(),
    cpf: zodCpfDigits.optional(),
    cnpj: zodCnpjDigits.optional(),
    razaoSocial: z
      .string()
      .trim()
      .min(1, "Razão social é obrigatória")
      .max(160, "Razão social muito longa")
      .optional(),
    whatsapp: patchWhatsapp.optional(),
    email: patchEmail.optional(),
    specialties: castMemberBaseFields.specialties.optional(),
    manualInactive: z.boolean().optional(),
    notes: z.string().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe ao menos um campo para atualização",
  });

export type CastMemberFormData = z.output<typeof castMemberFormSchema>;
export type CastMemberPatchData = z.output<typeof castMemberPatchSchema>;
