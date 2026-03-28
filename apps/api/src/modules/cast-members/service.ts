import { CastMembersRepository } from "./repository.js";
import { serializeCastMember } from "./mapper.js";
import type { CastMemberFormData, CastMemberPatchData } from "./schemas.js";

const PROJECTS_PAGE_SIZE = 8;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizePhoneForStorage(input: string | null | undefined): string | null {
  const d = (input ?? "").replace(/\D/g, "").slice(0, 11);
  return d.length === 0 ? null : d;
}

function normalizeDocumentForStorage(
  input: string | null | undefined,
  expectedLength: 11 | 14,
): string | null {
  const d = (input ?? "").replace(/\D/g, "");
  if (d.length !== expectedLength) return null;
  return d;
}

export class CastMembersService {
  constructor(private readonly repo = new CastMembersRepository()) {}

  async syncCastMemberStatus(castMemberIds: string[]) {
    if (castMemberIds.length === 0) return;

    const alive = [];
    for (const id of castMemberIds) {
      const found = await this.repo.findById(id);
      if (found && found.status !== "INACTIVE") alive.push(id);
    }
    if (alive.length === 0) return;

    const counts = await this.repo.groupActiveProjectsByCastMember(alive);
    const busyIds = new Set(
      counts
        .filter((c) => c._count._all > 0 && c.castMemberId)
        .map((c) => c.castMemberId as string),
    );

    if (busyIds.size > 0) {
      await this.repo.updateManyStatus([...busyIds], "BUSY");
    }
    const availableIds = alive.filter((id) => !busyIds.has(id));
    if (availableIds.length > 0) {
      await this.repo.updateManyStatus(availableIds, "AVAILABLE");
    }
  }

  async list(params: { q?: string; status?: string; page?: string | null }) {
    const q = params.q?.trim() ?? "";
    const status = params.status ?? "";
    const pageRaw = params.page ?? null;

    const baseWhere = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { role: { contains: q, mode: "insensitive" as const } },
            { cpf: { contains: q } },
            { cnpj: { contains: q } },
            { razaoSocial: { contains: q, mode: "insensitive" as const } },
            { specialties: { hasSome: [q] } },
          ],
        }
      : {};

    const listWhere = {
      ...baseWhere,
      ...(status ? { status } : {}),
    };

    const [total, availableCount, busyCount, specRows] = await Promise.all([
      this.repo.count(listWhere),
      this.repo.count({ ...baseWhere, status: "AVAILABLE" }),
      this.repo.count({ ...baseWhere, status: "BUSY" }),
      this.repo.listSpecialties(listWhere),
    ]);

    const specialtyKinds = new Set(specRows.flatMap((r) => r.specialties)).size;
    const metrics = {
      total,
      available: availableCount,
      busy: busyCount,
      specialtyKinds,
    };

    if (pageRaw == null) {
      const members = await this.repo.findMany(listWhere);
      return {
        members: members.map((m) => {
          const uniqueProjectIds = new Set(m.characterAssignments.map((c) => c.projectId));
          return serializeCastMember(m, uniqueProjectIds.size);
        }),
        total,
        metrics,
      };
    }

    const pageRequested = Math.max(1, Math.floor(Number(pageRaw) || 1) || 1);
    const totalPages = Math.max(1, Math.ceil(total / PROJECTS_PAGE_SIZE));
    const page = Math.min(pageRequested, totalPages);
    const skip = (page - 1) * PROJECTS_PAGE_SIZE;

    const members = await this.repo.findMany(listWhere, { skip, take: PROJECTS_PAGE_SIZE });
    return {
      members: members.map((m) => {
        const uniqueProjectIds = new Set(m.characterAssignments.map((c) => c.projectId));
        return serializeCastMember(m, uniqueProjectIds.size);
      }),
      total,
      metrics,
    };
  }

  async create(input: CastMemberFormData) {
    const email = input.email;
    const whatsapp = normalizePhoneForStorage(input.whatsapp);

    const takenEmail = await this.repo.findByEmail(email);
    if (takenEmail) {
      return {
        conflict: {
          error: "Este e-mail já está cadastrado para outro dublador",
          field: "email" as const,
        },
      };
    }
    if (whatsapp) {
      const taken = await this.repo.findByWhatsapp(whatsapp);
      if (taken) {
        return {
          conflict: {
            error: "Este WhatsApp já está cadastrado para outro dublador",
            field: "whatsapp" as const,
          },
        };
      }
    }

    const member = await this.repo.create({
      name: input.name.trim(),
      role: "DUBLADOR",
      cpf: normalizeDocumentForStorage(input.cpf, 11)!,
      cnpj: normalizeDocumentForStorage(input.cnpj, 14)!,
      razaoSocial: input.razaoSocial.trim(),
      whatsapp,
      email,
      prefersEmail: true,
      prefersWhatsapp: true,
      specialties: input.specialties ?? [],
      status: input.manualInactive ? "INACTIVE" : "AVAILABLE",
      notes: input.notes?.trim() || null,
    });
    if (member.status !== "INACTIVE") {
      await this.syncCastMemberStatus([member.id]);
    }
    const refreshed = await this.repo.findById(member.id);
    return { member: serializeCastMember(refreshed ?? member) };
  }

  async getById(id: string) {
    const member = await this.repo.findById(id);
    if (!member) return null;
    return { member: serializeCastMember(member) };
  }

  async patch(id: string, input: CastMemberPatchData) {
    const existing = await this.repo.findById(id);
    if (!existing) return { notFound: true as const };

    const nextEmail =
      input.email !== undefined
        ? input.email
        : existing.email
          ? existing.email.trim().toLowerCase()
          : null;
    const nextWhatsapp =
      input.whatsapp !== undefined
        ? normalizePhoneForStorage(input.whatsapp)
        : existing.whatsapp;

    const emailTrim = (nextEmail ?? "").trim();
    if (!emailTrim || !EMAIL_RE.test(emailTrim)) {
      return {
        badRequest: { error: "E-mail é obrigatório e deve ser válido" } as const,
      };
    }
    const waDigits = (nextWhatsapp ?? "").replace(/\D/g, "");
    if (waDigits.length < 10 || waDigits.length > 11) {
      return {
        badRequest: {
          error: "WhatsApp é obrigatório (DDD + número, 10 ou 11 dígitos)",
        } as const,
      };
    }

    const nextCpf = input.cpf !== undefined ? input.cpf : existing.cpf;
    const nextCnpj = input.cnpj !== undefined ? input.cnpj : existing.cnpj;
    const nextRazao =
      input.razaoSocial !== undefined
        ? input.razaoSocial.trim()
        : (existing.razaoSocial ?? "");
    if (!nextCpf || !nextCnpj || !nextRazao) {
      return {
        badRequest: { error: "CPF, CNPJ e razão social são obrigatórios" } as const,
      };
    }

    if (emailTrim && emailTrim !== (existing.email ?? "").toLowerCase()) {
      const taken = await this.repo.findByEmail(emailTrim, id);
      if (taken) {
        return {
          conflict: {
            error: "Este e-mail já está cadastrado para outro dublador",
            field: "email" as const,
          },
        };
      }
    }
    if (nextWhatsapp && nextWhatsapp !== existing.whatsapp) {
      const taken = await this.repo.findByWhatsapp(nextWhatsapp, id);
      if (taken) {
        return {
          conflict: {
            error: "Este WhatsApp já está cadastrado para outro dublador",
            field: "whatsapp" as const,
          },
        };
      }
    }

    await this.repo.update(id, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      role: "DUBLADOR",
      ...(input.cpf !== undefined ? { cpf: normalizeDocumentForStorage(input.cpf, 11) } : {}),
      ...(input.cnpj !== undefined ? { cnpj: normalizeDocumentForStorage(input.cnpj, 14) } : {}),
      ...(input.razaoSocial !== undefined
        ? { razaoSocial: input.razaoSocial.trim() || null }
        : {}),
      ...(input.whatsapp !== undefined ? { whatsapp: nextWhatsapp } : {}),
      ...(input.email !== undefined ? { email: emailTrim } : {}),
      prefersEmail: true,
      prefersWhatsapp: true,
      ...(input.specialties !== undefined ? { specialties: input.specialties } : {}),
      ...(input.manualInactive !== undefined
        ? { status: input.manualInactive ? "INACTIVE" : "AVAILABLE" }
        : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
    });

    const member = await this.repo.findById(id);
    if (!member) return { notFound: true as const };
    if (member.status !== "INACTIVE") {
      await this.syncCastMemberStatus([id]);
    }
    const refreshed = await this.repo.findById(id);
    if (!refreshed) return { notFound: true as const };
    return { member: serializeCastMember(refreshed) };
  }

  async remove(id: string) {
    await this.repo.delete(id);
    return { ok: true };
  }

  async castings(id: string) {
    const exists = await this.repo.findById(id);
    if (!exists) return null;
    const characters = await this.repo.findCastings(id);
    return {
      castings: characters.map((c) => ({
        characterId: c.character.id,
        characterName: c.character.name,
        voiceType: c.character.voiceType,
        importance: c.character.importance,
        projectId: c.project.id,
        projectName: c.project.name,
        projectStatus: c.project.status,
        projectClient: c.project.client,
        projectDeadline: c.project.deadline?.toISOString() ?? null,
        isActive: c.project.status !== "DONE" && c.project.status !== "PAUSED",
      })),
    };
  }
}
