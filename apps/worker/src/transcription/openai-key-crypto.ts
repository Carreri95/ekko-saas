import { createDecipheriv, createHash } from "node:crypto";

const ALGO = "aes-256-gcm";

function keyFromSecret(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

function fromB64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function decryptOpenAiKey(payload: string, secret: string): string {
  const parts = payload.split(".");
  if (parts.length !== 3) {
    throw new Error("Formato de chave cifrada inválido");
  }
  const [ivPart, tagPart, dataPart] = parts;
  const iv = fromB64Url(ivPart);
  const tag = fromB64Url(tagPart);
  const data = fromB64Url(dataPart);
  const key = keyFromSecret(secret);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]);
  return plain.toString("utf8");
}

