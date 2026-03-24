import { S3Client } from "@aws-sdk/client-s3";
import type { StorageConfig } from "./storage-config.js";

/**
 * Cliente S3 (MinIO-compatible). Usar apenas a partir de infraestrutura / health.
 */
export function createS3Client(config: StorageConfig): S3Client {
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}
