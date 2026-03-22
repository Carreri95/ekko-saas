import { NextResponse } from "next/server";
import type { ClientUpdateInput } from "@/app/generated/prisma/models/Client";
import { prisma } from "@/src/lib/prisma";
import { serializeClient } from "../serialize";
import {
  CLIENT_DUPLICATE_EMAIL_BODY,
  CLIENT_DUPLICATE_PHONE_BODY,
  handleClientUniqueError,
} from "../prisma-unique";
import { clientFormSchema, type ClientFormData } from "@/app/clientes/schemas";
import { normalizePhoneForStorage } from "@/src/lib/phone-format";

type RouteContext = { params: Promise<{ id: string }> };

function patchToUpdateData(d: Partial<ClientFormData>): ClientUpdateInput {
  const out: ClientUpdateInput = {};
  if (d.name !== undefined) out.name = d.name.trim();
  if (d.email !== undefined) {
    const t = d.email?.trim();
    out.email = t ? t.toLowerCase() : null;
  }
  if (d.phone !== undefined) {
    out.phone = normalizePhoneForStorage(d.phone);
  }
  if (d.country !== undefined) out.country = d.country?.trim() || null;
  if (d.notes !== undefined) out.notes = d.notes?.trim() || null;
  if (d.status !== undefined) out.status = d.status;
  return out;
}

export async function GET(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const client = await prisma.client.findUnique({
    where: { id },
    include: { _count: { select: { projects: true } } },
  });
  if (!client) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ client: serializeClient(client) });
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const existing = await prisma.client.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = clientFormSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const d = parsed.data;

  if (d.email !== undefined) {
    const emailNorm = d.email.trim().toLowerCase();
    if (emailNorm) {
      const taken = await prisma.client.findFirst({
        where: { email: emailNorm, NOT: { id } },
        select: { id: true },
      });
      if (taken) {
        return NextResponse.json(CLIENT_DUPLICATE_EMAIL_BODY, { status: 409 });
      }
    }
  }

  if (d.phone !== undefined) {
    const normalizedPhone = normalizePhoneForStorage(d.phone);
    if (normalizedPhone) {
      const taken = await prisma.client.findFirst({
        where: { phone: normalizedPhone, NOT: { id } },
        select: { id: true },
      });
      if (taken) {
        return NextResponse.json(CLIENT_DUPLICATE_PHONE_BODY, { status: 409 });
      }
    }
  }

  try {
    const client = await prisma.client.update({
      where: { id },
      data: patchToUpdateData(d),
      include: { _count: { select: { projects: true } } },
    });
    return NextResponse.json({ client: serializeClient(client) });
  } catch (error) {
    const conflict = handleClientUniqueError(error);
    if (conflict) return conflict;
    throw error;
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  await prisma.client.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
