import {
  CreateBucketCommand,
  HeadBucketCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import type { StorageConfig } from "./storage-config.js";
import { createS3Client } from "./s3-client.js";

export type EnsureBucketsResult = {
  created: string[];
  alreadyExisted: string[];
};

function isHeadBucketMissing(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    e.name === "NotFound" ||
    e.name === "NoSuchBucket" ||
    e.$metadata?.httpStatusCode === 404
  );
}

function isCreateBucketConflict(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    name?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    e.name === "BucketAlreadyOwnedByYou" ||
    e.name === "BucketAlreadyExists" ||
    e.$metadata?.httpStatusCode === 409
  );
}

/**
 * Garante que um bucket existe (idempotente). Usa HeadBucket; só cria se não existir.
 */
export async function ensureBucketExists(
  client: S3Client,
  bucket: string,
): Promise<"created" | "existed"> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return "existed";
  } catch (err: unknown) {
    if (!isHeadBucketMissing(err)) {
      throw err;
    }
  }

  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    return "created";
  } catch (err: unknown) {
    if (isCreateBucketConflict(err)) {
      return "existed";
    }
    throw err;
  }
}

/**
 * Garante os buckets definidos em `StorageConfig` (`bucketMedia`, `bucketTemp`).
 * Idempotente: execuções repetidas não falham se os buckets já existirem.
 */
export async function ensureStorageBuckets(
  config: StorageConfig,
): Promise<EnsureBucketsResult> {
  const client = createS3Client(config);
  const names = [config.bucketMedia, config.bucketTemp];
  const unique = [...new Set(names)];

  const created: string[] = [];
  const alreadyExisted: string[] = [];

  for (const bucket of unique) {
    const outcome = await ensureBucketExists(client, bucket);
    if (outcome === "created") {
      created.push(bucket);
    } else {
      alreadyExisted.push(bucket);
    }
  }

  return { created, alreadyExisted };
}
