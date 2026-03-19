import { NextResponse } from "next/server";

import { prisma } from "../../../../../src/lib/prisma";

type RouteParams = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: RouteParams) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "subtitleFileId obrigatorio" }, { status: 400 });
  }

  const subtitleFile = await prisma.subtitleFile.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!subtitleFile) {
    return NextResponse.json({ error: "SubtitleFile nao encontrado" }, { status: 404 });
  }

  const versions = await prisma.subtitleVersion.findMany({
    where: { subtitleFileId: id },
    orderBy: { versionNumber: "desc" },
    select: {
      id: true,
      versionNumber: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    subtitleFileId: id,
    versions,
  });
}

