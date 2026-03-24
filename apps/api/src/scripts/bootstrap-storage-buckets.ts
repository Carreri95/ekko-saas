/**
 * Bootstrap idempotente dos buckets MinIO/S3 definidos em `S3_BUCKET_*`.
 * Sem `S3_ENDPOINT`: termina com exit 0 (storage desligado; nada a fazer).
 */
import "../load-env.js";
import { ensureStorageBuckets } from "../infrastructure/storage/ensure-buckets.js";
import { loadStorageConfig } from "../infrastructure/storage/storage-config.js";

async function main(): Promise<void> {
  const state = loadStorageConfig();

  if (state.status === "disabled") {
    console.log(
      "[storage:bootstrap] S3_ENDPOINT não definido — storage desligado. Nada a fazer.",
    );
    process.exit(0);
  }

  if (state.status === "misconfigured") {
    console.error(`[storage:bootstrap] ${state.message}`);
    process.exit(1);
  }

  const { bucketMedia, bucketTemp } = state.config;
  console.log(
    `[storage:bootstrap] A garantir buckets: "${bucketMedia}", "${bucketTemp}" …`,
  );

  const { created, alreadyExisted } = await ensureStorageBuckets(state.config);

  if (created.length > 0) {
    console.log(`[storage:bootstrap] Criados: ${created.join(", ")}`);
  }
  if (alreadyExisted.length > 0) {
    console.log(`[storage:bootstrap] Já existiam: ${alreadyExisted.join(", ")}`);
  }
  console.log("[storage:bootstrap] Concluído.");
}

void main().catch((err: unknown) => {
  console.error("[storage:bootstrap] Falha:", err);
  process.exit(1);
});
