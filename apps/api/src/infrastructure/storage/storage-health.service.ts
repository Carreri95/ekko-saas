import { ListBucketsCommand } from "@aws-sdk/client-s3";
import { createS3Client } from "./s3-client.js";
import { loadStorageConfig, type StorageConfigState } from "./storage-config.js";

export type StorageHealthResult =
  | { ok: true; mode: "disabled"; message: string }
  | { ok: false; mode: "misconfigured"; message: string }
  | { ok: true; mode: "ok"; buckets: string[] }
  | { ok: false; mode: "unreachable"; message: string };

/**
 * Verifica conectividade e credenciais (ListBuckets). Não usa rotas de negócio.
 */
export async function checkStorageHealth(): Promise<StorageHealthResult> {
  const state: StorageConfigState = loadStorageConfig();

  if (state.status === "disabled") {
    return {
      ok: true,
      mode: "disabled",
      message:
        "Storage S3 não configurado (defina S3_ENDPOINT para ativar). A API funciona sem MinIO.",
    };
  }

  if (state.status === "misconfigured") {
    return {
      ok: false,
      mode: "misconfigured",
      message: state.message,
    };
  }

  const client = createS3Client(state.config);

  try {
    const out = await client.send(new ListBucketsCommand({}));
    const buckets = (out.Buckets ?? [])
      .map((b) => b.Name)
      .filter((n): n is string => Boolean(n));
    return { ok: true, mode: "ok", buckets };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      mode: "unreachable",
      message: msg,
    };
  }
}
