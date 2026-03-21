import { NextResponse } from "next/server";

import { getDefaultUserId } from "../../../src/server/demo-user";
import { isDatabaseConnectionError } from "../../../src/server/prisma-errors";
import { prisma } from "../../../src/lib/prisma";

type Body = {
  name?: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Body JSON invalido" }, { status: 400 });
  }

  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name e obrigatorio" }, { status: 400 });
  }

  try {
    const userId = await getDefaultUserId();
    if (!userId) {
      return NextResponse.json(
        {
          error:
            "Nenhum utilizador demo na base de dados. Com Postgres a correr e DATABASE_URL em web/.env, execute na pasta web: npm run db:seed (ou npm run seed). Cria demo@subtitlestudio.local.",
        },
        { status: 500 },
      );
    }

    const project = await prisma.project.create({
      data: {
        name,
        userId,
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (e) {
    if (isDatabaseConnectionError(e)) {
      return NextResponse.json(
        {
          error:
            "Base de dados indisponível. Arranque o PostgreSQL (na raiz: docker compose up -d), confirme DATABASE_URL em web/.env e execute npm run db:migrate e npm run db:seed.",
        },
        { status: 503 },
      );
    }
    throw e;
  }
}
