import { NextResponse } from "next/server";
import { z } from "zod";
import { syncCastMemberStatus } from "@/app/api/cast-members/sync-status";
import { prisma } from "@/src/lib/prisma";
import { serializeProjectCharacter } from "../serialize";

const castMemberIdField = z.preprocess(
  (v) => (v === "" ? null : v),
  z.union([z.string().min(1), z.null()]).optional(),
);

function optionalStringField(max: number) {
  return z.preprocess(
    (v) => (v === null || v === undefined ? undefined : v),
    z.union([z.literal(""), z.string().max(max)]).optional(),
  );
}

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  type: optionalStringField(60),
  voiceType: optionalStringField(60),
  importance: z.enum(["MAIN", "SUPPORT", "EXTRA"]).optional(),
  castMemberId: castMemberIdField,
  notes: optionalStringField(500),
});

type RouteContext = { params: Promise<{ id: string; charId: string }> };

async function getCharacterInProject(projectId: string, charId: string) {
  return prisma.projectCharacter.findFirst({
    where: { id: charId, projectId },
  });
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const { id: projectId, charId } = await ctx.params;

  const existing = await getCharacterInProject(projectId, charId);
  if (!existing) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const d = parsed.data;
  const oldMemberId = existing.castMemberId;
  const newMemberId =
    d.castMemberId !== undefined ? d.castMemberId : existing.castMemberId;

  const character = await prisma.projectCharacter.update({
    where: { id: charId },
    data: {
      ...(d.name !== undefined && { name: d.name }),
      ...(d.type !== undefined && { type: d.type || null }),
      ...(d.voiceType !== undefined && { voiceType: d.voiceType || null }),
      ...(d.importance !== undefined && { importance: d.importance }),
      ...(d.castMemberId !== undefined && { castMemberId: d.castMemberId }),
      ...(d.notes !== undefined && { notes: d.notes || null }),
    },
    include: { castMember: { select: { id: true, name: true, role: true } } },
  });

  const affected = [oldMemberId, newMemberId].filter(
    (x): x is string => Boolean(x),
  );
  if (affected.length > 0) {
    await syncCastMemberStatus([...new Set(affected)]);
  }

  return NextResponse.json({ character: serializeProjectCharacter(character) });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const { id: projectId, charId } = await ctx.params;

  const existing = await getCharacterInProject(projectId, charId);
  if (!existing) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const castMemberId = existing.castMemberId;

  await prisma.projectCharacter.delete({ where: { id: charId } });

  if (castMemberId) {
    await syncCastMemberStatus([castMemberId]);
  }

  return NextResponse.json({ ok: true });
}
