import { NextResponse } from "next/server";

import { prisma } from "../../../../src/lib/prisma";

const DEMO_EMAIL = "demo@subtitlestudio.local";
const DEMO_PROJECT_NAME = "Demo Project";

export async function GET() {
  const demoUser = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    select: { id: true },
  });

  if (!demoUser) {
    return NextResponse.json(
      { error: "Usuário demo não encontrado. Rode a seed." },
      { status: 404 }
    );
  }

  const existingProject = await prisma.project.findFirst({
    where: { userId: demoUser.id, name: DEMO_PROJECT_NAME },
    select: { id: true, name: true },
  });

  const project = existingProject
    ? existingProject
    : await prisma.project.create({
        data: {
          userId: demoUser.id,
          name: DEMO_PROJECT_NAME,
        },
        select: { id: true, name: true },
      });

  return NextResponse.json({
    projectId: project.id,
    projectName: project.name,
  });
}

