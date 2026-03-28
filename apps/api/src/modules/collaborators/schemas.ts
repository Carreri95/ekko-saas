import { z } from "zod";
import { validateActiveCommunicationChannels } from "../../lib/communication-channel-validation.js";
import { zodCnpjDigits, zodCpfDigits } from "../../lib/zod-documents.js";

export const collaboratorRoleSchema = z.enum([
  "RECORDING_TECHNICIAN",
  "POST_PRODUCTION",
  "MIXER",
  "PRE_PRODUCTION",
]);

const collaboratorBaseFields = {
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
};

export const collaboratorFormSchema = z
  .object(collaboratorBaseFields)
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

export const collaboratorPatchSchema = z
  .object({
    name: collaboratorBaseFields.name.optional(),
    cpf: zodCpfDigits.optional(),
    cnpj: zodCnpjDigits.optional(),
    razaoSocial: z
      .string()
      .trim()
      .min(1, "Razão social é obrigatória")
      .max(160, "Razão social muito longa")
      .optional(),
    role: collaboratorRoleSchema.optional(),
    whatsapp: z.string().optional(),
    email: z.string().optional(),
    prefersEmail: z.boolean().optional(),
    prefersWhatsapp: z.boolean().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe ao menos um campo para atualização",
  });

export type CollaboratorFormData = z.output<typeof collaboratorFormSchema>;
export type CollaboratorPatchData = z.output<typeof collaboratorPatchSchema>;
