import { NextResponse } from "next/server";
import type { CastMemberUpdateInput } from "@/app/generated/prisma/models/CastMember";
import { CastMemberStatus } from "@/app/generated/prisma/enums";
import { prisma } from "@/src/lib/prisma";
import { serializeCastMember } from "../serialize";
import { syncCastMemberStatus } from "../sync-status";
import {
  CAST_MEMBER_DUPLICATE_EMAIL_BODY,
  CAST_MEMBER_DUPLICATE_WHATSAPP_BODY,
  handleCastMemberUniqueError,
} from "../prisma-unique";
import { castMemberFormSchema, type CastMemberFormData } from "@/app/elenco/schemas";
import { normalizePhoneForStorage } from "@/src/lib/phone-format";

type RouteContext = { params: Promise<{ id: string }> };

function patchToUpdateData(d: Partial<CastMemberFormData>): CastMemberUpdateInput {
  const out: CastMemberUpdateInput = {};
  if (d.name !== undefined) out.name = d.name.trim();
  if (d.role !== undefined) out.role = d.role?.trim() || null;
  if (d.whatsapp !== undefined) {
    out.whatsapp = normalizePhoneForStorage(d.whatsapp);
  }
  if (d.email !== undefined) {
    const t = d.email?.trim();
    out.email = t ? t.toLowerCase() : null;
  }
  if (d.specialties !== undefined) out.specialties = d.specialties;
  if (d.manualInactive !== undefined) {
    out.status = d.manualInactive
      ? CastMemberStatus.INACTIVE
      : CastMemberStatus.AVAILABLE;
  }
  if (d.notes !== undefined) out.notes = d.notes?.trim() || null;
  return out;
}

export async function GET(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const member = await prisma.castMember.findUnique({ where: { id } });
  if (!member) return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  return NextResponse.json({ member: serializeCastMember(member) });
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const existing = await prisma.castMember.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = castMemberFormSchema.partial().safeParse(body);
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
      const taken = await prisma.castMember.findFirst({
        where: { email: emailNorm, NOT: { id } },
        select: { id: true },
      });
      if (taken) {
        return NextResponse.json(CAST_MEMBER_DUPLICATE_EMAIL_BODY, {
          status: 409,
        });
      }
    }
  }

  if (d.whatsapp !== undefined) {
    const normalizedPhone = normalizePhoneForStorage(d.whatsapp);
    if (normalizedPhone) {
      const taken = await prisma.castMember.findFirst({
        where: { whatsapp: normalizedPhone, NOT: { id } },
        select: { id: true },
      });
      if (taken) {
        return NextResponse.json(CAST_MEMBER_DUPLICATE_WHATSAPP_BODY, {
          status: 409,
        });
      }
    }
  }

  try {
    await prisma.castMember.update({
      where: { id },
      data: patchToUpdateData(d),
    });
    const member = await prisma.castMember.findUnique({ where: { id } });
    if (!member) {
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    }
    if (member.status !== CastMemberStatus.INACTIVE) {
      await syncCastMemberStatus([id]);
    }
    const refreshed = await prisma.castMember.findUnique({ where: { id } });
    if (!refreshed) {
      return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
    }
    return NextResponse.json({ member: serializeCastMember(refreshed) });
  } catch (error) {
    const conflict = handleCastMemberUniqueError(error);
    if (conflict) return conflict;
    throw error;
  }
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  await prisma.castMember.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
