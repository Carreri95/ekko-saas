import type { PrismaClient } from "../../generated/prisma/client.js";

export async function findLatestSubtitleFileForProject(
  db: PrismaClient,
  projectId: string,
) {
  return db.subtitleFile.findFirst({
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
