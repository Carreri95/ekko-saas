import { NextResponse } from "next/server";
import {
  DubbingProjectStatus,
  PaymentType,
  ValueCurrency,
} from "@/app/generated/prisma/enums";
import { PROJECTS_PAGE_SIZE } from "@/app/projetos/constants";
import {
  computeProjectMetrics,
  type ProjectMetricsSource,
} from "@/app/projetos/lib/projetos-metrics";
import { prisma } from "@/src/lib/prisma";
import { serializeDubbingProject } from "./serialize";
import { normalizeMoneyForStorage } from "@/app/projetos/lib/project-finance";
import { dubbingProjectFormSchema } from "@/app/projetos/schemas";

const STATUS_SET = new Set<string>(Object.values(DubbingProjectStatus));

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const q = searchParams.get("q");
  const pageRaw = searchParams.get("page");
  const pageSize = PROJECTS_PAGE_SIZE;
  const pageRequested = Math.max(1, Math.floor(Number(pageRaw) || 1) || 1);

  if (status && !STATUS_SET.has(status)) {
    return NextResponse.json({ error: "status inválido" }, { status: 400 });
  }

  const where = {
    ...(status ? { status: status as DubbingProjectStatus } : {}),
    ...(q?.trim()
      ? {
          OR: [
            { name: { contains: q.trim(), mode: "insensitive" as const } },
            { client: { contains: q.trim(), mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const total = await prisma.dubbingProject.count({ where });

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(pageRequested, totalPages);
  const skip = (page - 1) * pageSize;

  const [pageRows, metricRows] = await Promise.all([
    prisma.dubbingProject.findMany({
      where,
      orderBy: [{ status: "asc" }, { deadline: "asc" }],
      skip,
      take: pageSize,
    }),
    prisma.dubbingProject.findMany({
      where,
      select: {
        episodes: true,
        durationMin: true,
        value: true,
        valueCurrency: true,
        status: true,
        deadline: true,
      },
    }),
  ]);

  const metricsSources: ProjectMetricsSource[] = metricRows.map((r) => ({
    episodes: r.episodes,
    durationMin: r.durationMin,
    value: r.value != null ? r.value.toString() : null,
    valueCurrency: r.valueCurrency,
    status: r.status,
    deadline: r.deadline?.toISOString() ?? null,
  }));

  const metrics = computeProjectMetrics(metricsSources);

  return NextResponse.json({
    projects: pageRows.map(serializeDubbingProject),
    total,
    page,
    pageSize,
    metrics,
  });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = dubbingProjectFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Dados inválidos",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 400 },
    );
  }

  const d = parsed.data;
  const raw = body as Record<string, unknown>;

  const startDate = new Date(d.startDate);
  const deadline = new Date(d.deadline);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(deadline.getTime())
  ) {
    return NextResponse.json({ error: "Datas inválidas" }, { status: 400 });
  }

  try {
    const project = await prisma.dubbingProject.create({
      data: {
        name: d.name,
        client: d.client,
        clientId: d.clientId ?? null,
        status: DubbingProjectStatus.SPOTTING,
        startDate,
        deadline,
        episodes: Math.floor(d.episodes),
        durationMin: Math.floor(d.durationMin),
        language: d.language.trim() ? d.language.trim() : null,
        value: normalizeMoneyForStorage(Number(d.value)),
        valueCurrency: d.valueCurrency ?? ValueCurrency.BRL,
        paymentType: d.paymentType ?? PaymentType.PER_PROJECT,
        notes:
          d.notes !== undefined && d.notes !== null && String(d.notes).trim()
            ? String(d.notes).trim()
            : null,
        userId:
          typeof raw.userId === "string" && raw.userId.trim()
            ? raw.userId.trim()
            : null,
      },
    });

    return NextResponse.json(
      { project: serializeDubbingProject(project) },
      { status: 201 },
    );
  } catch (e) {
    console.error("[POST /api/dubbing-projects]", e);
    const msg =
      e instanceof Error && e.message.includes("Unknown argument")
        ? "Cliente Prisma desatualizado. Pare o dev server, execute `npx prisma generate`, apague a pasta `.next` e inicie de novo."
        : "Erro ao criar projeto.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
