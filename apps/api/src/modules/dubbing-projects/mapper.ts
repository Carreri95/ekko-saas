export type DubbingProjectSerializeInput = {
  id: string;
  name: string;
  client: string | null;
  clientId: string | null;
  status: string;
  startDate: Date | null;
  deadline: Date | null;
  episodes: number | null;
  durationMin: number | null;
  language: string | null;
  value: { toString(): string } | number | null;
  paymentType: string;
  valueCurrency: string;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  userId: string | null;
};

export function serializeDubbingProject(p: DubbingProjectSerializeInput) {
  return {
    id: p.id,
    name: p.name,
    client: p.client,
    clientId: p.clientId,
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

type CharacterRow = {
  id: string;
  projectId: string;
  name: string;
  type: string | null;
  voiceType: string | null;
  importance: "MAIN" | "SUPPORT" | "EXTRA";
  castMemberId: string | null;
  castMember: { id: string; name: string; role: string | null } | null;
  notes: string | null;
  createdAt: Date;
};

export function serializeProjectCharacter(c: CharacterRow) {
  return {
    id: c.id,
    projectId: c.projectId,
    name: c.name,
    type: c.type,
    voiceType: c.voiceType,
    importance: c.importance,
    castMemberId: c.castMemberId,
    castMember: c.castMember
      ? {
          id: c.castMember.id,
          name: c.castMember.name,
          role: c.castMember.role,
        }
      : null,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
  };
}
