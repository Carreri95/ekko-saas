import { z } from "zod";

export const castMemberFormSchema = z.object({
  name: z.string().min(1, "Nome completo é obrigatório").max(120, "Nome muito longo"),
  role: z.string().min(1, "Função / cargo é obrigatório").max(80, "Função muito longa"),
  whatsapp: z.string().min(8, "WhatsApp é obrigatório").max(20, "WhatsApp inválido"),
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  specialties: z
    .array(z.string().min(1))
    .min(1, "Adicione pelo menos uma especialidade")
    .max(10, "Máximo de 10 especialidades"),
  manualInactive: z.boolean(),
  notes: z.string(),
});

export const castMemberPatchSchema = castMemberFormSchema.partial();

export type CastMemberFormData = z.output<typeof castMemberFormSchema>;
export type CastMemberPatchData = z.output<typeof castMemberPatchSchema>;
