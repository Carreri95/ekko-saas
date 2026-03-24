import { ClientsRepository } from "./repository.js";
import type { ClientFormData, ClientPatchData } from "./schemas.js";
import { serializeClient } from "./mapper.js";

const PROJECTS_PAGE_SIZE = 8;

function normalizePhoneForStorage(input: string | null | undefined): string | null {
  const d = (input ?? "").replace(/\D/g, "").slice(0, 11);
  return d.length === 0 ? null : d;
}

function roundMoney2(v: number): number {
  return Math.round(v * 100) / 100;
}

function computeCurrencyTotals(projects: Array<{ value: string | null; valueCurrency: "BRL" | "USD" }>) {
  const acc: Partial<Record<"BRL" | "USD", number>> = {};
  for (const p of projects) {
    const v = Number(p.value ?? 0);
    if (!Number.isFinite(v) || v <= 0) continue;
    const c = p.valueCurrency ?? "BRL";
    acc[c] = (acc[c] ?? 0) + v;
  }
  return (Object.entries(acc) as ["BRL" | "USD", number][])
    .map(([currency, total]) => ({
      currency,
      symbol: currency === "BRL" ? "R$" : "$",
      total: roundMoney2(total),
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export class ClientsService {
  constructor(private readonly repo = new ClientsRepository()) {}

  async list(params: { q?: string; status?: string; page?: string | null }) {
    const q = params.q?.trim() ?? "";
    const status = params.status ?? "";
    const pageRaw = params.page ?? null;

    const baseWhere = q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {};

    const listWhere = {
      ...baseWhere,
      ...(status ? { status } : {}),
    };

    const [total, activeCount, projectCountRows, projectValues] = await Promise.all([
      this.repo.count(listWhere),
      this.repo.count({ ...baseWhere, status: "ACTIVE" }),
      this.repo.findMany(listWhere),
      this.repo.listProjectValues(),
    ]);

    const projectsLinked = projectCountRows.reduce(
      (sum, c) => sum + (c._count?.projects ?? 0),
      0,
    );

    const kpis = {
      currencyTotals: computeCurrencyTotals(
        projectValues.map((p) => ({
          value: p.value != null ? String(p.value) : null,
          valueCurrency: p.valueCurrency,
        })),
      ),
      projectsLinked,
      activeCount,
      total,
    };

    if (pageRaw == null) {
      return {
        clients: projectCountRows.map(serializeClient),
        total,
        kpis,
      };
    }

    const pageRequested = Math.max(1, Math.floor(Number(pageRaw) || 1) || 1);
    const totalPages = Math.max(1, Math.ceil(total / PROJECTS_PAGE_SIZE));
    const page = Math.min(pageRequested, totalPages);
    const skip = (page - 1) * PROJECTS_PAGE_SIZE;

    const clients = await this.repo.findMany(listWhere, {
      skip,
      take: PROJECTS_PAGE_SIZE,
    });

    return {
      clients: clients.map(serializeClient),
      total,
      kpis,
    };
  }

  async create(input: ClientFormData) {
    const emailNorm = input.email?.trim() ? input.email.trim().toLowerCase() : null;
    const phoneNorm = normalizePhoneForStorage(input.phone);

    if (emailNorm) {
      const taken = await this.repo.findByEmail(emailNorm);
      if (taken) return { conflict: { error: "Este e-mail ja esta cadastrado", field: "email" as const } };
    }

    if (phoneNorm) {
      const taken = await this.repo.findByPhone(phoneNorm);
      if (taken) return { conflict: { error: "Este telefone ja esta cadastrado", field: "phone" as const } };
    }

    const created = await this.repo.create({
      name: input.name.trim(),
      email: emailNorm,
      phone: phoneNorm,
      country: input.country?.trim() || null,
      notes: input.notes?.trim() || null,
      status: input.status,
    });

    return { client: serializeClient(created) };
  }

  async getById(id: string) {
    const client = await this.repo.findById(id);
    if (!client) return null;
    return { client: serializeClient(client) };
  }

  async patch(id: string, input: ClientPatchData) {
    const existing = await this.repo.findById(id);
    if (!existing) return { notFound: true as const };

    if (input.email !== undefined) {
      const emailNorm = input.email.trim().toLowerCase();
      if (emailNorm) {
        const taken = await this.repo.findByEmail(emailNorm, id);
        if (taken) return { conflict: { error: "Este e-mail ja esta cadastrado", field: "email" as const } };
      }
    }

    if (input.phone !== undefined) {
      const phoneNorm = normalizePhoneForStorage(input.phone);
      if (phoneNorm) {
        const taken = await this.repo.findByPhone(phoneNorm, id);
        if (taken) return { conflict: { error: "Este telefone ja esta cadastrado", field: "phone" as const } };
      }
    }

    const updated = await this.repo.update(id, {
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.email !== undefined
        ? { email: input.email.trim() ? input.email.trim().toLowerCase() : null }
        : {}),
      ...(input.phone !== undefined ? { phone: normalizePhoneForStorage(input.phone) } : {}),
      ...(input.country !== undefined ? { country: input.country?.trim() || null } : {}),
      ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    });

    return { client: serializeClient(updated) };
  }

  async remove(id: string) {
    await this.repo.delete(id);
    return { ok: true };
  }
}
