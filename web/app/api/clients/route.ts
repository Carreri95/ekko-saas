import { NextResponse } from "next/server";
import { ClientStatus } from "@/app/generated/prisma/enums";
import { PROJECTS_PAGE_SIZE } from "@/app/projetos/constants";
import { computeCurrencyTotals } from "@/app/projetos/lib/projetos-metrics";
import { prisma } from "@/src/lib/prisma";
import { serializeClient } from "./serialize";
import {
  CLIENT_DUPLICATE_EMAIL_BODY,
  CLIENT_DUPLICATE_PHONE_BODY,
  handleClientUniqueError,
} from "./prisma-unique";
import { clientFormSchema } from "@/app/clientes/schemas";
import { normalizePhoneForStorage } from "@/src/lib/phone-format";

const STATUS_SET = new Set<string>(Object.values(ClientStatus));

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const status = searchParams.get("status") ?? "";
  const pageRaw = searchParams.get("page");

  if (status && !STATUS_SET.has(status)) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }

  const baseWhere = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { email: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const listWhere = {
    ...baseWhere,
    ...(status ? { status: status as ClientStatus } : {}),
  };

  const [total, activeCount, projectCountRows, projectValues] = await Promise.all([
    prisma.client.count({ where: listWhere }),
    prisma.client.count({
      where: { ...baseWhere, status: ClientStatus.ACTIVE },
    }),
    prisma.client.findMany({
      where: listWhere,
      select: { _count: { select: { projects: true } } },
    }),
    prisma.dubbingProject.findMany({
      select: { value: true, valueCurrency: true },
    }),
  ]);

  const projectsLinked = projectCountRows.reduce(
    (s, c) => s + (c._count?.projects ?? 0),
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
    const clients = await prisma.client.findMany({
      where: listWhere,
      include: { _count: { select: { projects: true } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({
      clients: clients.map(serializeClient),
      total,
      kpis,
    });
  }

  const pageSize = PROJECTS_PAGE_SIZE;
  const pageRequested = Math.max(1, Math.floor(Number(pageRaw) || 1) || 1);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(pageRequested, totalPages);
  const skip = (page - 1) * pageSize;

  const clients = await prisma.client.findMany({
    where: listWhere,
    include: { _count: { select: { projects: true } } },
    orderBy: { name: "asc" },
    skip,
    take: pageSize,
  });

  return NextResponse.json({
    clients: clients.map(serializeClient),
    total,
    kpis,
  });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = clientFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const d = parsed.data;
  const normalizedPhone = normalizePhoneForStorage(d.phone);

  const emailNorm = d.email?.trim() ? d.email.trim().toLowerCase() : null;
  if (emailNorm) {
    const existing = await prisma.client.findFirst({
      where: { email: emailNorm },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(CLIENT_DUPLICATE_EMAIL_BODY, { status: 409 });
    }
  }

  if (normalizedPhone) {
    const existing = await prisma.client.findFirst({
      where: { phone: normalizedPhone },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(CLIENT_DUPLICATE_PHONE_BODY, { status: 409 });
    }
  }

  try {
    const client = await prisma.client.create({
      data: {
        name: d.name.trim(),
        email: emailNorm,
        phone: normalizedPhone,
        country: d.country?.trim() || null,
        notes: d.notes?.trim() || null,
        status: d.status,
      },
      include: { _count: { select: { projects: true } } },
    });
    return NextResponse.json({ client: serializeClient(client) }, { status: 201 });
  } catch (error) {
    const conflict = handleClientUniqueError(error);
    if (conflict) return conflict;
    throw error;
  }
}
