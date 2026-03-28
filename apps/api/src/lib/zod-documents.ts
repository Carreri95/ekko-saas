import { z } from "zod";

export function digitsOnly(input: string): string {
  return input.replace(/\D/g, "");
}

/** CPF: só aceita valor completo (11 dígitos após remover máscara). */
export const zodCpfDigits = z
  .string()
  .transform((s) => digitsOnly(s))
  .refine((d) => d.length === 11, { message: "CPF deve ter 11 dígitos" });

/** CNPJ: só aceita valor completo (14 dígitos após remover máscara). */
export const zodCnpjDigits = z
  .string()
  .transform((s) => digitsOnly(s))
  .refine((d) => d.length === 14, { message: "CNPJ deve ter 14 dígitos" });
