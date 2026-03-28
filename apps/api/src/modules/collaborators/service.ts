import { validateActiveCommunicationChannels } from "../../lib/communication-channel-validation.js";
import { serializeCollaborator } from "./mapper.js";
import { CollaboratorsRepository } from "./repository.js";
import type { CollaboratorFormData, CollaboratorPatchData } from "./schemas.js";

const PROJECTS_PAGE_SIZE = 8;

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

export class CollaboratorsService {
  constructor(private readonly repo = new CollaboratorsRepository()) {}

  async list(params: { q?: string; role?: string; page?: string | null }) {
    const q = params.q?.trim() ?? "";
    const role = params.role ?? "";
    const pageRaw = params.page ?? null;

    const baseWhere = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
            { cpf: { contains: q } },
            { cnpj: { contains: q } },
            { razaoSocial: { contains: q, mode: "insensitive" as const } },
            { role: { equals: q as never } },
          ],
        }
      : {};

    const listWhere = {
      ...baseWhere,
      ...(role ? { role } : {}),
    };

    const [total, roleGroups] = await Promise.all([
      this.repo.count(listWhere),
      this.repo.groupByRole(listWhere),
    ]);

    const metrics = {
      total,
      recordingTechnician: 0,
      postProduction: 0,
      mixer: 0,
      preProduction: 0,
    };
    for (const row of roleGroups) {
      const n = row._count._all;
      if (row.role === "RECORDING_TECHNICIAN") metrics.recordingTechnician = n;
      else if (row.role === "POST_PRODUCTION") metrics.postProduction = n;
      else if (row.role === "MIXER") metrics.mixer = n;
      else if (row.role === "PRE_PRODUCTION") metrics.preProduction = n;
    }

    if (pageRaw == null) {
      const collaborators = await this.repo.findMany(listWhere);
      return {
        collaborators: collaborators.map(serializeCollaborator),
        total,
        metrics,
      };
    }

    const pageRequested = Math.max(1, Math.floor(Number(pageRaw) || 1) || 1);
    const totalPages = Math.max(1, Math.ceil(total / PROJECTS_PAGE_SIZE));
    const page = Math.min(pageRequested, totalPages);
    const skip = (page - 1) * PROJECTS_PAGE_SIZE;
    const collaborators = await this.repo.findMany(listWhere, {
      skip,
      take: PROJECTS_PAGE_SIZE,
    });
    return {
      collaborators: collaborators.map(serializeCollaborator),
      total,
      metrics,
    };
  }

  async create(input: CollaboratorFormData) {
    const email = input.email.trim() ? input.email.trim().toLowerCase() : "";
    const whatsapp = normalizePhoneForStorage(input.whatsapp);
    if (email) {
      const taken = await this.repo.findByEmail(email);
      if (taken) {
        return {
          conflict: {
            error: "Este e-mail já está cadastrado para outro colaborador",
            field: "email" as const,
          },
        };
      }
    }
    if (whatsapp) {
      const taken = await this.repo.findByWhatsapp(whatsapp);
      if (taken) {
        return {
          conflict: {
            error: "Este WhatsApp já está cadastrado para outro colaborador",
            field: "whatsapp" as const,
          },
        };
      }
    }

    const collaborator = await this.repo.create({
      name: input.name.trim(),
      cpf: normalizeDocumentForStorage(input.cpf, 11)!,
      cnpj: normalizeDocumentForStorage(input.cnpj, 14)!,
      razaoSocial: input.razaoSocial.trim(),
      role: input.role,
      email: email || null,
      whatsapp,
      prefersEmail: input.prefersEmail,
      prefersWhatsapp: input.prefersWhatsapp,
    });
    return { collaborator: serializeCollaborator(collaborator) };
  }

  async getById(id: string) {
    const collaborator = await this.repo.findById(id);
    if (!collaborator) return null;
    return { collaborator: serializeCollaborator(collaborator) };
  }

  async patch(id: string, input: CollaboratorPatchData) {
    const existing = await this.repo.findById(id);
    if (!existing) return { notFound: true as const };

    const nextEmail =
      input.email !== undefined
        ? input.email.trim()
          ? input.email.trim().toLowerCase()
          : null
        : existing.email;
    const nextWhatsapp =
      input.whatsapp !== undefined
        ? normalizePhoneForStorage(input.whatsapp)
        : existing.whatsapp;
    const nextPrefersEmail = input.prefersEmail ?? existing.prefersEmail;
    const nextPrefersWhatsapp = input.prefersWhatsapp ?? existing.prefersWhatsapp;

    const prefs = validateActiveCommunicationChannels({
      prefersEmail: nextPrefersEmail,
      prefersWhatsapp: nextPrefersWhatsapp,
      email: nextEmail,
      whatsapp: nextWhatsapp ?? "",
    });
    if ("error" in prefs) {
      return { badRequest: { error: prefs.error } as const };
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

    if (nextEmail && nextEmail !== (existing.email ?? "").toLowerCase()) {
      const taken = await this.repo.findByEmail(nextEmail, id);
      if (taken) {
        return {
          conflict: {
            error: "Este e-mail já está cadastrado para outro colaborador",
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
            error: "Este WhatsApp já está cadastrado para outro colaborador",
            field: "whatsapp" as const,
          },
        };
      }
    }

    const updated = await this.repo.update(id, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.cpf !== undefined ? { cpf: normalizeDocumentForStorage(input.cpf, 11) } : {}),
      ...(input.cnpj !== undefined ? { cnpj: normalizeDocumentForStorage(input.cnpj, 14) } : {}),
      ...(input.razaoSocial !== undefined
        ? { razaoSocial: input.razaoSocial.trim() || null }
        : {}),
      ...(input.role !== undefined ? { role: input.role } : {}),
      ...(input.email !== undefined ? { email: nextEmail } : {}),
      ...(input.whatsapp !== undefined ? { whatsapp: nextWhatsapp } : {}),
      ...(input.prefersEmail !== undefined ? { prefersEmail: input.prefersEmail } : {}),
      ...(input.prefersWhatsapp !== undefined
        ? { prefersWhatsapp: input.prefersWhatsapp }
        : {}),
    });

    return { collaborator: serializeCollaborator(updated) };
  }

  async remove(id: string) {
    await this.repo.delete(id);
    return { ok: true };
  }
}
