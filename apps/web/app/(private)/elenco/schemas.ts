import { z } from "zod";
import { digitsOnly } from "@/src/lib/document-format";

const zodCpfDigits = z
  .string()
  .transform((s) => digitsOnly(s))
  .refine((d) => d.length === 11, "CPF deve ter 11 dígitos");

const zodCnpjDigits = z
  .string()
  .transform((s) => digitsOnly(s))
  .refine((d) => d.length === 14, "CNPJ deve ter 14 dígitos");

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

/** Disponível / Em projeto são automáticos; só "inativo" é escolha manual. */
export const castMemberFormSchema = z.object({
  name: z
    .string()
    .min(1, "Nome completo é obrigatório")
    .max(120, "Nome muito longo"),

  cpf: zodCpfDigits,
  cnpj: zodCnpjDigits,

  razaoSocial: z
    .string()
    .trim()
    .min(1, "Razão social é obrigatória")
    .max(160, "Razão social muito longa"),

  whatsapp: zodCastMemberWhatsappDigits,
  email: zodCastMemberEmail,

  /** Política fixa para dublador: ambos ativos (UI travada). */
  prefersEmail: z.literal(true),
  prefersWhatsapp: z.literal(true),

  specialties: z
    .array(z.string().min(1))
    .min(1, "Adicione pelo menos uma especialidade")
    .max(10, "Máximo de 10 especialidades"),

  manualInactive: z.boolean(),

  notes: z.string(),
});

export type CastMemberFormInput = z.input<typeof castMemberFormSchema>;
export type CastMemberFormData = z.output<typeof castMemberFormSchema>;
