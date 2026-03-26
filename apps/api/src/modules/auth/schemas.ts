import { z } from "zod";

export const authLoginBodySchema = z.object({
  email: z.string().trim().min(1).email(),
  password: z.string().min(1),
});

export const authProfilePatchSchema = z
  .object({
    name: z.union([z.string().max(200), z.null()]).optional(),
    displayName: z.union([z.string().max(200), z.null()]).optional(),
    avatarUrl: z
      .union([z.string().url().max(2000), z.literal(""), z.null()])
      .optional(),
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: "Nenhum campo para atualizar",
  });

export const authPasswordChangeSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8, "A nova senha deve ter pelo menos 8 caracteres"),
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "As senhas novas não coincidem",
    path: ["confirmPassword"],
  });

export const authOpenAiKeyPutSchema = z.object({
  apiKey: z.string().trim().min(20, "Chave OpenAI inválida."),
});
