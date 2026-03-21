import { NextResponse } from "next/server";

import { getBatchJobService } from "../../../../../src/server/transcription/transcription-services";

type RouteParams = { params: Promise<{ batchId: string }> };

export async function GET(_: Request, { params }: RouteParams) {
  const { batchId } = await params;
  if (!batchId) {
    return NextResponse.json({ error: "batchId obrigatorio" }, { status: 400 });
  }

  try {
    const buf = await getBatchJobService().buildZipForDoneJobs(batchId);
    const safe = `legendas-${batchId.slice(0, 8)}.zip`;
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safe}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("nao encontrado")) {
      return NextResponse.json({ error: msg }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
