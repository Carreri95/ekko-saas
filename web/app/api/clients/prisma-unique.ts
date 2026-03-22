import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";

export const CLIENT_DUPLICATE_EMAIL_BODY = {
  error: "Este e-mail já está cadastrado",
  field: "email" as const,
};

export const CLIENT_DUPLICATE_PHONE_BODY = {
  error: "Este telefone já está cadastrado",
  field: "phone" as const,
};

const UNIQUE_FIELD_MESSAGES: Record<
  string,
  { field: string; message: string }
> = {
  email: { field: "email", message: "Este e-mail já está cadastrado" },
  phone: { field: "phone", message: "Este telefone já está cadastrado" },
};

export function handleClientUniqueError(error: unknown): NextResponse | null {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return null;
  }
  const targets = (error.meta?.target as string[]) ?? [];
  for (const field of targets) {
    const msg = UNIQUE_FIELD_MESSAGES[field];
    if (msg) {
      return NextResponse.json(
        { error: msg.message, field: msg.field },
        { status: 409 },
      );
    }
  }
  return NextResponse.json(
    { error: "Registro duplicado", field: null },
    { status: 409 },
  );
}
