import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";
import { serializeProjectCharacter } from "../serialize";

const castMemberIdField = z.preprocess(
  (v) => (v === "" ? null : v),
  z.union([z.string().min(1), z.null()]).optional(),
);

const patchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  type: z.union([z.literal(""), z.string().max(60)]).optional(),
  voiceType: z.union([z.literal(""), z.string().max(60)]).optional(),
  importance: z.enum(["MAIN", "SUPPORT", "EXTRA"]).optional(),
  castMemberId: castMemberIdField,
  notes: z.union([z.literal(""), z.string().max(500)]).optional(),
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
  return NextResponse.json({ character: serializeProjectCharacter(character) });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const { id: projectId, charId } = await ctx.params;

  const existing = await getCharacterInProject(projectId, charId);
  if (!existing) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  await prisma.projectCharacter.delete({ where: { id: charId } });
  return NextResponse.json({ ok: true });
}
