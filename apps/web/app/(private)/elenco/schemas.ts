import { z } from "zod";

const preferredCommunicationChannelSchema = z.enum(["EMAIL", "WHATSAPP"]);

/** Disponível / Em projeto são automáticos; só "inativo" é escolha manual. */
export const castMemberFormSchema = z.object({
  name: z
    .string()
    .min(1, "Nome completo é obrigatório")
    .max(120, "Nome muito longo"),

  role: z
    .string()
    .min(1, "Função / cargo é obrigatório")
    .max(80, "Função muito longa"),

  whatsapp: z
    .string()
    .min(8, "WhatsApp é obrigatório")
    .max(20, "WhatsApp inválido"),

  email: z
    .string()
    .min(1, "E-mail é obrigatório")
    .email("E-mail inválido"),

  preferredCommunicationChannel: preferredCommunicationChannelSchema,

  specialties: z
    .array(z.string().min(1))
    .min(1, "Adicione pelo menos uma especialidade")
    .max(10, "Máximo de 10 especialidades"),

  manualInactive: z.boolean(),

  notes: z.string(),
});

export type CastMemberFormInput = z.infer<typeof castMemberFormSchema>;
export type CastMemberFormData = z.infer<typeof castMemberFormSchema>;
