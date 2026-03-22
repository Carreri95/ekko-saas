import { NextResponse } from "next/server";
import { prisma } from "@/src/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

// GET /api/cast-members/[id]/castings — personagens / projetos do dublador
export async function GET(_req: Request, ctx: RouteContext) {
  const { id: castMemberId } = await ctx.params;

  const exists = await prisma.castMember.findUnique({
    where: { id: castMemberId },
    select: { id: true },
  });
  if (!exists) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const characters = await prisma.projectCharacter.findMany({
    where: { castMemberId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          status: true,
          deadline: true,
          client: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const castings = characters.map((c) => ({
    characterId: c.id,
    characterName: c.name,
    voiceType: c.voiceType,
    importance: c.importance,
    projectId: c.project.id,
    projectName: c.project.name,
    projectStatus: c.project.status,
    projectClient: c.project.client,
    projectDeadline: c.project.deadline?.toISOString() ?? null,
    isActive:
      c.project.status !== "DONE" && c.project.status !== "PAUSED",
  }));

  return NextResponse.json({ castings });
}
