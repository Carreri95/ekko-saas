import type { PrismaClient } from "../../app/generated/prisma/client";

export async function findLatestSubtitleFileForProject(
  prisma: PrismaClient,
  projectId: string,
) {
  return prisma.subtitleFile.findFirst({
    where: { projectId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      filename: true,
      wavFilename: true,
      wavPath: true,
      projectId: true,
    },
  });
}
