import { NextResponse } from "next/server";

import { getDefaultUserId } from "../../../src/server/demo-user";
import { isDatabaseConnectionError } from "../../../src/server/prisma-errors";
import { getBatchJobService } from "../../../src/server/transcription/transcription-services";

export async function POST() {
  try {
    const userId = await getDefaultUserId();
    if (!userId) {
      return NextResponse.json(
        {
          error:
            "Nenhum utilizador demo na base de dados. Execute npm run db:seed na pasta web.",
        },
        { status: 500 },
      );
    }

    const batch = await getBatchJobService().createBatch(userId);
    return NextResponse.json({ batchId: batch.id }, { status: 201 });
  } catch (e) {
    if (isDatabaseConnectionError(e)) {
      return NextResponse.json(
        {
          error:
            "Base de dados indisponivel. Arranque o PostgreSQL e confirme DATABASE_URL.",
        },
        { status: 503 },
      );
    }
    console.error("[POST /api/batch-jobs]", e);
    const message =
      e instanceof Error ? e.message : "Erro ao criar batch.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
