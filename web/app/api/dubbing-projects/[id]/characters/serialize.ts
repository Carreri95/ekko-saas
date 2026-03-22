import type { ProjectCharacter } from "@/app/generated/prisma/client";
import type { ProjectCharacterDto } from "@/app/types/project-character";

type Row = ProjectCharacter & {
  castMember: { id: string; name: string; role: string | null } | null;
};

export function serializeProjectCharacter(c: Row): ProjectCharacterDto {
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
