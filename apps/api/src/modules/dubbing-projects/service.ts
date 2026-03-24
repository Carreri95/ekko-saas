import { DubbingProjectsRepository } from "./repository.js";
import {
  type CharacterCreateData,
  type CharacterPatchData,
  type DubbingProjectCreateData,
  type DubbingProjectPatchData,
} from "./schemas.js";
import { serializeDubbingProject, serializeProjectCharacter } from "./mapper.js";
import { CastMembersService } from "../cast-members/service.js";

const PROJECTS_PAGE_SIZE = 8;

function roundMoney2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function normalizeMoneyForStorage(n: number): number {
  return roundMoney2(n);
}

function computeProjectMetrics(
  projects: Array<{
    episodes: number | null;
    durationMin: number | null;
    value: string | null;
    valueCurrency: "BRL" | "USD";
    status: string;
    deadline: string | null;
  }>,
) {
  const totalEp = projects.reduce((s, p) => s + (p.episodes ?? 0), 0);
  const totalMin = projects.reduce((s, p) => s + (p.durationMin ?? 0), 0);
  const totalVal = projects.reduce((s, p) => s + Number(p.value ?? 0), 0);

  const acc: Partial<Record<"BRL" | "USD", number>> = {};
  for (const p of projects) {
    const v = Number(p.value ?? 0);
    if (!Number.isFinite(v) || v <= 0) continue;
    const c = p.valueCurrency ?? "BRL";
    acc[c] = (acc[c] ?? 0) + v;
  }
  const currencyTotals = (Object.entries(acc) as ["BRL" | "USD", number][])
    .map(([currency, total]) => ({
      currency,
      symbol: currency === "BRL" ? "R$" : "$",
      total: roundMoney2(total),
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));

  const active = projects.filter((p) => p.status !== "PAUSED" && p.status !== "DONE").length;
  const paused = projects.filter((p) => p.status === "PAUSED").length;
  const late = projects.filter((p) => (p.deadline ? new Date(p.deadline).getTime() < Date.now() : false)).length;

  return {
    totalEp,
    totalMin,
    totalVal,
    currencyTotals,
    active,
    paused,
    late,
    projectCount: projects.length,
  };
}

export class DubbingProjectsService {
  constructor(
    private readonly repo = new DubbingProjectsRepository(),
    private readonly castService = new CastMembersService(),
  ) {}

  async list(params: { status?: string | null; q?: string | null; page?: string | null }) {
    const status = params.status ?? null;
    const q = params.q ?? null;
    const pageRaw = params.page ?? null;
    const pageRequested = Math.max(1, Math.floor(Number(pageRaw) || 1) || 1);

    const where = {
      ...(status ? { status } : {}),
      ...(q?.trim()
        ? {
            OR: [
              { name: { contains: q.trim(), mode: "insensitive" as const } },
              { client: { contains: q.trim(), mode: "insensitive" as const } },
            ],
          }
        : {}),
    };

    const total = await this.repo.count(where);
    const totalPages = Math.max(1, Math.ceil(total / PROJECTS_PAGE_SIZE));
    const page = Math.min(pageRequested, totalPages);
    const skip = (page - 1) * PROJECTS_PAGE_SIZE;

    const [pageRows, metricRows] = await Promise.all([
      this.repo.findMany(where, { skip, take: PROJECTS_PAGE_SIZE }),
      this.repo.findMetricsRows(where),
    ]);

    const metrics = computeProjectMetrics(
      metricRows.map((r) => ({
        episodes: r.episodes,
        durationMin: r.durationMin,
        value: r.value != null ? r.value.toString() : null,
        valueCurrency: r.valueCurrency,
        status: r.status,
        deadline: r.deadline?.toISOString() ?? null,
      })),
    );

    return {
      projects: pageRows.map(serializeDubbingProject),
      total,
      page,
      pageSize: PROJECTS_PAGE_SIZE,
      metrics,
    };
  }

  async create(input: DubbingProjectCreateData, rawUserId?: unknown) {
    const startDate = new Date(input.startDate);
    const deadline = new Date(input.deadline);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(deadline.getTime())) {
      return { badRequest: { error: "Datas inválidas" } };
    }

    const created = await this.repo.create({
      name: input.name,
      client: input.client,
      clientId: input.clientId ?? null,
      status: "SPOTTING",
      startDate,
      deadline,
      episodes: Math.floor(input.episodes),
      durationMin: Math.floor(input.durationMin),
      language: input.language.trim() ? input.language.trim() : null,
      value: normalizeMoneyForStorage(Number(input.value)),
      valueCurrency: input.valueCurrency ?? "BRL",
      paymentType: input.paymentType ?? "PER_PROJECT",
      notes:
        input.notes !== undefined && input.notes !== null && String(input.notes).trim()
          ? String(input.notes).trim()
          : null,
      userId: typeof rawUserId === "string" && rawUserId.trim() ? rawUserId.trim() : null,
    });
    return { project: serializeDubbingProject(created) };
  }

  async getById(id: string) {
    const project = await this.repo.findById(id);
    if (!project) return null;
    return { project: serializeDubbingProject(project) };
  }

  async patch(id: string, input: DubbingProjectPatchData, raw: Record<string, unknown>) {
    const existing = await this.repo.findById(id);
    if (!existing) return { notFound: true as const };

    const startForOrder =
      input.startDate !== undefined
        ? input.startDate === null || input.startDate === ""
          ? null
          : input.startDate
        : existing.startDate
          ? existing.startDate.toISOString().slice(0, 10)
          : null;
    const deadlineForOrder =
      input.deadline !== undefined
        ? input.deadline === null || input.deadline === ""
          ? null
          : input.deadline
        : existing.deadline
          ? existing.deadline.toISOString().slice(0, 10)
          : null;
    if (startForOrder && deadlineForOrder && deadlineForOrder < startForOrder) {
      return { badRequest: { error: "O prazo de entrega não pode ser anterior à data de início" } };
    }

    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.client !== undefined) data.client = input.client === "" ? null : input.client;
    if (input.clientId !== undefined) data.clientId = input.clientId;
    if (input.status !== undefined) data.status = input.status;
    if (input.startDate !== undefined) {
      if (input.startDate === null || input.startDate === "") data.startDate = null;
      else {
        const dt = new Date(input.startDate);
        if (Number.isNaN(dt.getTime())) return { badRequest: { error: "startDate inválido" } };
        data.startDate = dt;
      }
    }
    if (input.deadline !== undefined) {
      if (input.deadline === null || input.deadline === "") data.deadline = null;
      else {
        const dt = new Date(input.deadline);
        if (Number.isNaN(dt.getTime())) return { badRequest: { error: "deadline inválido" } };
        data.deadline = dt;
      }
    }
    if (input.episodes !== undefined) data.episodes = Math.floor(input.episodes);
    if (input.durationMin !== undefined) data.durationMin = Math.floor(input.durationMin);
    if (input.language !== undefined) data.language = input.language.trim() ? input.language.trim() : null;
    if (input.value !== undefined) data.value = input.value === null ? null : normalizeMoneyForStorage(Number(input.value));
    if (input.valueCurrency !== undefined) data.valueCurrency = input.valueCurrency;
    if (input.paymentType !== undefined) data.paymentType = input.paymentType;
    if (input.notes !== undefined) {
      data.notes =
        input.notes === null || input.notes === "" || !String(input.notes).trim()
          ? null
          : String(input.notes).trim();
    }
    if (raw.userId !== undefined) {
      data.userId = typeof raw.userId === "string" && raw.userId.trim() ? raw.userId.trim() : null;
    }

    if (Object.keys(data).length === 0) {
      return { project: serializeDubbingProject(existing) };
    }

    const statusBefore = existing.status;
    const updated = await this.repo.update(id, data);
    if (input.status !== undefined && input.status !== statusBefore) {
      const rows = await this.repo.findProjectCharacterMemberIds(id);
      const memberIds = [...new Set(rows.map((r) => r.castMemberId).filter((v): v is string => Boolean(v)))];
      if (memberIds.length > 0) {
        await this.castService.syncCastMemberStatus(memberIds);
      }
    }
    return { project: serializeDubbingProject(updated) };
  }

  async remove(id: string) {
    const existing = await this.repo.findById(id);
    if (!existing) return { notFound: true as const };
    await this.repo.delete(id);
    return { noContent: true as const };
  }

  async listCharacters(projectId: string) {
    const project = await this.repo.findById(projectId);
    if (!project) return null;
    const characters = await this.repo.findProjectCharacters(projectId);
    return { characters: characters.map(serializeProjectCharacter) };
  }

  async createCharacter(projectId: string, input: CharacterCreateData) {
    const project = await this.repo.findById(projectId);
    if (!project) return { notFound: true as const };
    const created = await this.repo.createProjectCharacter(projectId, {
      name: input.name,
      type: input.type || null,
      voiceType: input.voiceType || null,
      importance: input.importance,
      castMemberId: input.castMemberId ?? null,
      notes: input.notes || null,
    });
    if (input.castMemberId) {
      await this.castService.syncCastMemberStatus([input.castMemberId]);
    }
    return { character: serializeProjectCharacter(created) };
  }

  async patchCharacter(projectId: string, charId: string, input: CharacterPatchData) {
    const existing = await this.repo.findCharacterInProject(projectId, charId);
    if (!existing) return { notFound: true as const };
    const oldMemberId = existing.castMemberId;
    const updated = await this.repo.updateCharacter(charId, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.type !== undefined && { type: input.type || null }),
      ...(input.voiceType !== undefined && { voiceType: input.voiceType || null }),
      ...(input.importance !== undefined && { importance: input.importance }),
      ...(input.castMemberId !== undefined && { castMemberId: input.castMemberId }),
      ...(input.notes !== undefined && { notes: input.notes || null }),
    });
    const newMemberId = input.castMemberId !== undefined ? input.castMemberId : existing.castMemberId;
    const affected = [oldMemberId, newMemberId].filter((x): x is string => Boolean(x));
    if (affected.length > 0) {
      await this.castService.syncCastMemberStatus([...new Set(affected)]);
    }
    return { character: serializeProjectCharacter(updated) };
  }

  async deleteCharacter(projectId: string, charId: string) {
    const existing = await this.repo.findCharacterInProject(projectId, charId);
    if (!existing) return { notFound: true as const };
    const castMemberId = existing.castMemberId;
    await this.repo.deleteCharacter(charId);
    if (castMemberId) {
      await this.castService.syncCastMemberStatus([castMemberId]);
    }
    return { ok: true };
  }
}
