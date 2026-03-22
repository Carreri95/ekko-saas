import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";

export const CAST_MEMBER_DUPLICATE_EMAIL_BODY = {
  error: "Este e-mail já está cadastrado para outro dublador",
  field: "email" as const,
};

export const CAST_MEMBER_DUPLICATE_WHATSAPP_BODY = {
  error: "Este WhatsApp já está cadastrado para outro dublador",
  field: "whatsapp" as const,
};

const UNIQUE_FIELD_MESSAGES: Record<
  string,
  { field: string; message: string }
> = {
  email: {
    field: "email",
    message: "Este e-mail já está cadastrado para outro dublador",
  },
  whatsapp: {
    field: "whatsapp",
    message: "Este WhatsApp já está cadastrado para outro dublador",
  },
};

/** Responde 409 com `{ error, field }` em violações de unicidade (P2002). */
export function handleCastMemberUniqueError(
  error: unknown,
): NextResponse | null {
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
