/**
 * Configuração S3-compatible (MinIO). Toda a leitura de env fica aqui.
 * Se `S3_ENDPOINT` estiver ausente, o storage é considerado "desligado" (API corre sem MinIO).
 */
export type StorageConfig = {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketMedia: string;
  bucketTemp: string;
  forcePathStyle: boolean;
};

export type StorageConfigState =
  | { status: "disabled" }
  | { status: "misconfigured"; message: string }
  | { status: "ready"; config: StorageConfig };

const DEFAULT_REGION = "us-east-1";
const DEFAULT_BUCKET_MEDIA = "subtitlebot-media";
const DEFAULT_BUCKET_TEMP = "subtitlebot-temp";

function parseBoolean(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === undefined || raw === "") return defaultValue;
  const v = raw.trim().toLowerCase();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return defaultValue;
}

/**
 * Interpreta envs. Regra: sem `S3_ENDPOINT` => desligado.
 * Com `S3_ENDPOINT`, exige também region, access key e secret (senão misconfigured).
 */
export function loadStorageConfig(): StorageConfigState {
  const endpoint = process.env.S3_ENDPOINT?.trim();
  if (!endpoint) {
    return { status: "disabled" };
  }

  const region = process.env.S3_REGION?.trim() || DEFAULT_REGION;
  const accessKeyId = process.env.S3_ACCESS_KEY?.trim();
  const secretAccessKey = process.env.S3_SECRET_KEY?.trim();

  if (!accessKeyId || !secretAccessKey) {
    return {
      status: "misconfigured",
      message:
        "S3_ENDPOINT definido mas faltam S3_ACCESS_KEY e/ou S3_SECRET_KEY (ou estão vazios).",
    };
  }

  const bucketMedia = process.env.S3_BUCKET_MEDIA?.trim() || DEFAULT_BUCKET_MEDIA;
  const bucketTemp = process.env.S3_BUCKET_TEMP?.trim() || DEFAULT_BUCKET_TEMP;
  const forcePathStyle = parseBoolean(process.env.S3_FORCE_PATH_STYLE, true);

  return {
    status: "ready",
    config: {
      endpoint,
      region,
      accessKeyId,
      secretAccessKey,
      bucketMedia,
      bucketTemp,
      forcePathStyle,
    },
  };
}
