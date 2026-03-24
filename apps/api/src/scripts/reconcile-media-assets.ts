/**
 * PR 5.4 — reconciliação idempotente de `MediaAsset.subtitleFileId` com o asset corrente
 * (regra: Project.storageKey; ver `media-asset-current.ts`).
 *
 * Uso:
 *   npx tsx src/scripts/reconcile-media-assets.ts --dry-run
 *   npx tsx src/scripts/reconcile-media-assets.ts --apply
 */
import { prisma } from "../infrastructure/db/prisma.client.js";
import { resolveCurrentMediaAsset } from "../modules/projects/media-asset-current.js";
import {
  findMediaAssetsWithWrongSubtitleFileLink,
  findMultipleCurrentCandidates,
  findProjectsWithStorageKeyButNoCurrentAsset,
  findWavPathDivergencesFromProjectStorageKey,
} from "../modules/projects/media-asset-inconsistency.js";
import { findLatestSubtitleFileForProject } from "../modules/projects/subtitle-file-queries.js";

function parseArgs(): { apply: boolean } {
  return { apply: process.argv.includes("--apply") };
}

async function main(): Promise<void> {
  const { apply } = parseArgs();
  const mode = apply ? "APPLY" : "DRY-RUN";

  console.log(`[media:reconcile] Modo: ${mode}`);

  const noCurrent = await findProjectsWithStorageKeyButNoCurrentAsset();
  const wavDiv = await findWavPathDivergencesFromProjectStorageKey();
  const wrongLinks = await findMediaAssetsWithWrongSubtitleFileLink();
  const multi = await findMultipleCurrentCandidates();

  console.log("\n--- Resumo de inconsistências (deteção) ---");
  console.log(`Project com storageKey sem asset corrente: ${noCurrent.length}`);
  if (noCurrent.length) {
    console.log(JSON.stringify(noCurrent.slice(0, 20), null, 2));
    if (noCurrent.length > 20) console.log(`... e mais ${noCurrent.length - 20}`);
  }

  console.log(`\nDivergência wavPath vs Project.storageKey: ${wavDiv.length}`);
  if (wavDiv.length) {
    console.log(JSON.stringify(wavDiv.slice(0, 20), null, 2));
    if (wavDiv.length > 20) console.log(`... e mais ${wavDiv.length - 20}`);
  }

  console.log(`\nMediaAsset com vínculo subtitleFileId suspeito: ${wrongLinks.length}`);
  if (wrongLinks.length) {
    console.log(JSON.stringify(wrongLinks.slice(0, 30), null, 2));
    if (wrongLinks.length > 30) console.log(`... e mais ${wrongLinks.length - 30}`);
  }

  console.log(`\nMúltiplos candidatos correntes (anomalia): ${multi.length}`);
  if (multi.length) {
    console.log(JSON.stringify(multi, null, 2));
  }

  const projects = await prisma.project.findMany({
    where: { storageKey: { not: null } },
    select: { id: true, storageKey: true },
  });

  type PlanSetSubtitle = { type: "set"; mediaAssetId: string; subtitleFileId: string };
  type PlanClearSubtitle = { type: "clear"; mediaAssetId: string; reason: string };
  const plan: Array<PlanSetSubtitle | PlanClearSubtitle> = [];

  for (const p of projects) {
    const sk = p.storageKey!;
    const activeSf = await findLatestSubtitleFileForProject(prisma, p.id);
    if (!activeSf) continue;

    const current = await resolveCurrentMediaAsset(p.id, sk);

    if (current && current.subtitleFileId !== activeSf.id) {
      plan.push({
        type: "set",
        mediaAssetId: current.id,
        subtitleFileId: activeSf.id,
      });
    }

    const linkedToActive = await prisma.mediaAsset.findMany({
      where: { subtitleFileId: activeSf.id },
      select: { id: true },
    });

    for (const row of linkedToActive) {
      if (current && row.id === current.id) {
        continue;
      }
      plan.push({
        type: "clear",
        mediaAssetId: row.id,
        reason: current
          ? "historico_ou_incoerente_nao_deve_reter_fk_do_subtitle_ativo"
          : "sem_asset_corrente_mas_fk_para_subtitle_ativo",
      });
    }
  }

  console.log("\n--- Plano de reconciliação (subtitleFileId) ---");
  console.log(JSON.stringify(plan, null, 2));

  if (!apply) {
    console.log("\n[media:reconcile] DRY-RUN: nenhuma escrita. Use --apply para persistir.");
    return;
  }

  for (const step of plan) {
    if (step.type === "set") {
      await prisma.mediaAsset.update({
        where: { id: step.mediaAssetId },
        data: { subtitleFileId: step.subtitleFileId },
      });
      console.log(
        `[media:reconcile] OK set subtitleFileId em ${step.mediaAssetId} -> ${step.subtitleFileId}`,
      );
    } else {
      await prisma.mediaAsset.update({
        where: { id: step.mediaAssetId },
        data: { subtitleFileId: null },
      });
      console.log(
        `[media:reconcile] OK clear subtitleFileId em ${step.mediaAssetId} (${step.reason})`,
      );
    }
  }

  console.log("\n[media:reconcile] APPLY concluído.");
}

main().catch((e) => {
  console.error("[media:reconcile] Falha:", e);
  process.exit(1);
});
