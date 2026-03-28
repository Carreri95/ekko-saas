import { z } from "zod";
import { validateActiveCommunicationChannels } from "@/app/lib/communication-channel-validation";
import { digitsOnly } from "@/src/lib/document-format";

export const collaboratorRoleSchema = z.enum([
  "RECORDING_TECHNICIAN",
  "POST_PRODUCTION",
  "MIXER",
  "PRE_PRODUCTION",
]);

const zodCpfDigits = z
  .string()
  .transform((s) => digitsOnly(s))
  .refine((d) => d.length === 11, "CPF deve ter 11 dígitos");

const zodCnpjDigits = z
  .string()
  .transform((s) => digitsOnly(s))
  .refine((d) => d.length === 14, "CNPJ deve ter 14 dígitos");

export const collaboratorFormSchema = z
  .object({
    name: z.string().min(1, "Nome é obrigatório").max(120, "Nome muito longo"),
    cpf: zodCpfDigits,
    cnpj: zodCnpjDigits,
    razaoSocial: z
      .string()
      .trim()
      .min(1, "Razão social é obrigatória")
      .max(160, "Razão social muito longa"),
    role: collaboratorRoleSchema,
    whatsapp: z.string(),
    email: z.string(),
    prefersEmail: z.boolean(),
    prefersWhatsapp: z.boolean(),
  })
  .superRefine((data, ctx) => {
    const r = validateActiveCommunicationChannels({
      prefersEmail: data.prefersEmail,
      prefersWhatsapp: data.prefersWhatsapp,
      email: data.email,
      whatsapp: data.whatsapp,
    });
    if ("error" in r && r.error) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["prefersEmail"],
        message: r.error,
      });
    }
  });

export type CollaboratorFormInput = z.input<typeof collaboratorFormSchema>;
export type CollaboratorFormData = z.output<typeof collaboratorFormSchema>;
