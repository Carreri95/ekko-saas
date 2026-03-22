import { NextResponse } from "next/server";
import { CastMemberStatus } from "@/app/generated/prisma/enums";
import { PROJECTS_PAGE_SIZE } from "@/app/projetos/constants";
import { prisma } from "@/src/lib/prisma";
import { serializeCastMember } from "./serialize";
import {
  CAST_MEMBER_DUPLICATE_EMAIL_BODY,
  CAST_MEMBER_DUPLICATE_WHATSAPP_BODY,
  handleCastMemberUniqueError,
} from "./prisma-unique";
import { castMemberFormSchema } from "@/app/elenco/schemas";
import { normalizePhoneForStorage } from "@/src/lib/phone-format";

const STATUS_SET = new Set<string>(Object.values(CastMemberStatus));

// GET /api/cast-members?q=&status=&page=
// Sem `page`: devolve todos os registos (ex.: dropdowns). Com `page`: paginação (listagem).
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
            { role: { contains: q, mode: "insensitive" as const } },
            { specialties: { hasSome: [q] } },
          ],
        }
      : {}),
  };

  const listWhere = {
    ...baseWhere,
    ...(status ? { status: status as CastMemberStatus } : {}),
  };

  const [total, availableCount, busyCount, specRows] = await Promise.all([
    prisma.castMember.count({ where: listWhere }),
    prisma.castMember.count({
      where: { ...baseWhere, status: CastMemberStatus.AVAILABLE },
    }),
    prisma.castMember.count({
      where: { ...baseWhere, status: CastMemberStatus.BUSY },
    }),
    prisma.castMember.findMany({
      where: listWhere,
      select: { specialties: true },
    }),
  ]);

  const specialtyKinds = new Set(specRows.flatMap((r) => r.specialties)).size;

  const metrics = {
    total,
    available: availableCount,
    busy: busyCount,
    specialtyKinds,
  };

  if (pageRaw == null) {
    const members = await prisma.castMember.findMany({
      where: listWhere,
      orderBy: { name: "asc" },
    });
    return NextResponse.json({
      members: members.map(serializeCastMember),
      total,
      metrics,
    });
  }

  const pageSize = PROJECTS_PAGE_SIZE;
  const pageRequested = Math.max(1, Math.floor(Number(pageRaw) || 1) || 1);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(pageRequested, totalPages);
  const skip = (page - 1) * pageSize;

  const members = await prisma.castMember.findMany({
    where: listWhere,
    orderBy: { name: "asc" },
    skip,
    take: pageSize,
  });

  return NextResponse.json({
    members: members.map(serializeCastMember),
    total,
    metrics,
  });
}

// POST /api/cast-members
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const parsed = castMemberFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dados inválidos", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  const d = parsed.data;
  const emailNormalized = d.email.trim().toLowerCase();
  const normalizedPhone = normalizePhoneForStorage(d.whatsapp);

  if (emailNormalized) {
    const existing = await prisma.castMember.findFirst({
      where: { email: emailNormalized },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(CAST_MEMBER_DUPLICATE_EMAIL_BODY, {
        status: 409,
      });
    }
  }

  if (normalizedPhone) {
    const existing = await prisma.castMember.findFirst({
      where: { whatsapp: normalizedPhone },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(CAST_MEMBER_DUPLICATE_WHATSAPP_BODY, {
        status: 409,
      });
    }
  }

  try {
    const member = await prisma.castMember.create({
      data: {
        name: d.name.trim(),
        role: d.role?.trim() || null,
        whatsapp: normalizedPhone,
        email: emailNormalized || null,
        specialties: d.specialties ?? [],
        status: d.status,
        notes: d.notes?.trim() || null,
      },
    });
    return NextResponse.json(
      { member: serializeCastMember(member) },
      { status: 201 },
    );
  } catch (error) {
    const conflict = handleCastMemberUniqueError(error);
    if (conflict) return conflict;
    throw error;
  }
}
