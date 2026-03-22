import { NextResponse } from "next/server";
import type { Prisma } from "@/app/generated/prisma/client";
import {
  DubbingProjectStatus,
  PaymentType,
  type ValueCurrency,
} from "@/app/generated/prisma/enums";
import { prisma } from "@/src/lib/prisma";
import { serializeDubbingProject } from "../serialize";
import { normalizeMoneyForStorage } from "@/app/projetos/lib/project-finance";
import { dubbingProjectPatchRequestSchema } from "@/app/projetos/schemas";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const project = await prisma.dubbingProject.findUnique({ where: { id } });
  if (!project) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }
  return NextResponse.json({ project: serializeDubbingProject(project) });
}

export async function PATCH(req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const existing = await prisma.dubbingProject.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = dubbingProjectPatchRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const d = parsed.data;

  const startForOrder =
    d.startDate !== undefined
      ? d.startDate === null || d.startDate === ""
        ? null
        : d.startDate
      : existing.startDate
        ? existing.startDate.toISOString().slice(0, 10)
        : null;
  const deadlineForOrder =
    d.deadline !== undefined
      ? d.deadline === null || d.deadline === ""
        ? null
        : d.deadline
      : existing.deadline
        ? existing.deadline.toISOString().slice(0, 10)
        : null;
  if (
    startForOrder &&
    deadlineForOrder &&
    deadlineForOrder < startForOrder
  ) {
    return NextResponse.json(
      {
        error: "O prazo de entrega não pode ser anterior à data de início",
      },
      { status: 400 },
    );
  }
  const raw = body as Record<string, unknown>;

  const data: Prisma.DubbingProjectUpdateInput = {};

  if (d.name !== undefined) {
    data.name = d.name;
  }

  if (d.client !== undefined) {
    data.client = d.client === "" ? null : d.client;
  }

  if (d.clientId !== undefined) {
    if (d.clientId === null) {
      data.clientRef = { disconnect: true };
    } else {
      data.clientRef = { connect: { id: d.clientId } };
    }
  }

  if (d.status !== undefined) {
    data.status = d.status as DubbingProjectStatus;
  }

  if (d.startDate !== undefined) {
    if (d.startDate === null || d.startDate === "") {
      data.startDate = null;
    } else {
      const dt = new Date(d.startDate);
      if (Number.isNaN(dt.getTime())) {
        return NextResponse.json(
          { error: "startDate inválido" },
          { status: 400 },
        );
      }
      data.startDate = dt;
    }
  }

  if (d.deadline !== undefined) {
    if (d.deadline === null || d.deadline === "") {
      data.deadline = null;
    } else {
      const dt = new Date(d.deadline);
      if (Number.isNaN(dt.getTime())) {
        return NextResponse.json(
          { error: "deadline inválido" },
          { status: 400 },
        );
      }
      data.deadline = dt;
    }
  }

  if (d.episodes !== undefined) {
    data.episodes = Math.floor(d.episodes);
  }

  if (d.durationMin !== undefined) {
    data.durationMin = Math.floor(d.durationMin);
  }

  if (d.language !== undefined) {
    data.language = d.language.trim() ? d.language.trim() : null;
  }

  if (d.value !== undefined) {
    data.value =
      d.value === null
        ? null
        : normalizeMoneyForStorage(Number(d.value));
  }

  if (d.valueCurrency !== undefined) {
    data.valueCurrency = d.valueCurrency as ValueCurrency;
  }

  if (d.paymentType !== undefined) {
    data.paymentType = d.paymentType as PaymentType;
  }

  if (d.notes !== undefined) {
    data.notes =
      d.notes === null || d.notes === "" || !String(d.notes).trim()
        ? null
        : String(d.notes).trim();
  }

  if (raw.userId !== undefined) {
    data.userId =
      typeof raw.userId === "string" && raw.userId.trim()
        ? raw.userId.trim()
        : null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ project: serializeDubbingProject(existing) });
  }

  const project = await prisma.dubbingProject.update({
    where: { id },
    data,
  });

  return NextResponse.json({ project: serializeDubbingProject(project) });
}

export async function DELETE(_req: Request, ctx: RouteContext) {
  const { id } = await ctx.params;
  const existing = await prisma.dubbingProject.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }
  await prisma.dubbingProject.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
