import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/src/lib/prisma";
import { serializeProjectCharacter } from "./serialize";

/** Select HTML envia "" em vez de null quando vazio. */
const castMemberIdField = z.preprocess(
  (v) => (v === "" ? null : v),
  z.union([z.string().min(1), z.null()]).optional(),
);

const characterSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(80),
  type: z.union([z.literal(""), z.string().max(60)]).optional(),
  voiceType: z.union([z.literal(""), z.string().max(60)]).optional(),
  importance: z.enum(["MAIN", "SUPPORT", "EXTRA"]).default("SUPPORT"),
  castMemberId: castMemberIdField,
  notes: z.union([z.literal(""), z.string().max(500)]).optional(),
});

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/dubbing-projects/[id]/characters
export async function GET(_req: Request, ctx: RouteContext) {
  const { id: projectId } = await ctx.params;

  const project = await prisma.dubbingProject.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const characters = await prisma.projectCharacter.findMany({
    where: { projectId },
    include: { castMember: { select: { id: true, name: true, role: true } } },
    orderBy: [{ importance: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({
    characters: characters.map(serializeProjectCharacter),
  });
}

// POST /api/dubbing-projects/[id]/characters
export async function POST(req: Request, ctx: RouteContext) {
  const { id: projectId } = await ctx.params;

  const project = await prisma.dubbingProject.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = characterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const character = await prisma.projectCharacter.create({
    data: {
      projectId,
      name: d.name,
      type: d.type || null,
      voiceType: d.voiceType || null,
      importance: d.importance,
      castMemberId: d.castMemberId ?? null,
      notes: d.notes || null,
    },
    include: { castMember: { select: { id: true, name: true, role: true } } },
  });
  return NextResponse.json(
    { character: serializeProjectCharacter(character) },
    { status: 201 },
  );
}
