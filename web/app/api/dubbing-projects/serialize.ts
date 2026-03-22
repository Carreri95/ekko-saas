import type { DubbingProjectDto } from "@/app/types/dubbing-project";

/**
 * Forma mínima da linha DubbingProject vinda do Prisma, sem importar
 * `@/app/generated/prisma` (evita o Turbopack puxar o runtime do Prisma para o bundle do cliente).
 */
export type DubbingProjectSerializeInput = {
  id: string;
  name: string;
  client: string | null;
  status: DubbingProjectDto["status"];
  startDate: Date | null;
  deadline: Date | null;
  episodes: number | null;
  durationMin: number | null;
  language: string | null;
  /** Prisma Decimal ou número */
  value: { toString(): string } | number | null;
  paymentType: DubbingProjectDto["paymentType"];
  valueCurrency: DubbingProjectDto["valueCurrency"];
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  userId: string | null;
};

export function serializeDubbingProject(
  p: DubbingProjectSerializeInput,
): DubbingProjectDto {
  return {
    id: p.id,
    name: p.name,
    client: p.client,
    status: p.status,
    startDate: p.startDate?.toISOString() ?? null,
    deadline: p.deadline?.toISOString() ?? null,
    episodes: p.episodes,
    durationMin: p.durationMin,
    language: p.language,
    value: p.value != null ? p.value.toString() : null,
    valueCurrency: p.valueCurrency,
    paymentType: p.paymentType,
    notes: p.notes,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    userId: p.userId,
  };
}
