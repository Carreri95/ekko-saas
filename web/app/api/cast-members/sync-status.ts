import {
  CastMemberStatus,
  DubbingProjectStatus,
} from "@/app/generated/prisma/enums";
import { prisma } from "@/src/lib/prisma";

const INACTIVE = [DubbingProjectStatus.DONE, DubbingProjectStatus.PAUSED];

/**
 * Recalcula e atualiza o status de um ou mais dubladores com base nos projetos
 * ativos em que possuem personagem.
 *
 * Regras:
 * - INACTIVE (dublador) → nunca alterado aqui (controlo manual)
 * - Tem ≥ 1 ProjectCharacter em projeto ativo → BUSY
 * - Não tem nenhum projeto ativo → AVAILABLE
 *
 * Projetos "ativos" = status não é DONE nem PAUSED
 */
export async function syncCastMemberStatus(
  castMemberIds: string[],
): Promise<void> {
  if (castMemberIds.length === 0) return;

  const members = await prisma.castMember.findMany({
    where: {
      id: { in: castMemberIds },
      status: { not: CastMemberStatus.INACTIVE },
    },
    select: { id: true },
  });

  if (members.length === 0) return;

  const ids = members.map((m) => m.id);

  const counts = await prisma.projectCharacter.groupBy({
    by: ["castMemberId"],
    where: {
      castMemberId: { in: ids },
      project: {
        status: { notIn: INACTIVE },
      },
    },
    _count: { _all: true },
  });

  const busyIds = new Set(
    counts
      .filter((c) => c._count._all > 0 && c.castMemberId)
      .map((c) => c.castMemberId as string),
  );

  if (busyIds.size > 0) {
    await prisma.castMember.updateMany({
      where: {
        id: { in: [...busyIds] },
        status: { not: CastMemberStatus.INACTIVE },
      },
      data: { status: CastMemberStatus.BUSY },
    });
  }

  const availableIds = ids.filter((id) => !busyIds.has(id));
  if (availableIds.length > 0) {
    await prisma.castMember.updateMany({
      where: {
        id: { in: availableIds },
        status: { not: CastMemberStatus.INACTIVE },
      },
      data: { status: CastMemberStatus.AVAILABLE },
    });
  }
}
