import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;

function keyFromSecret(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

function toB64Url(buf: Buffer): string {
  return buf.toString("base64url");
}

function fromB64Url(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export function maskOpenAiKey(raw: string): string {
  const t = raw.trim();
  if (!t) return "••••";
  if (t.length <= 8) return `${t.slice(0, 2)}••••`;
  return `${t.slice(0, 4)}••••${t.slice(-4)}`;
}

export function encryptOpenAiKey(rawKey: string, secret: string): string {
  const key = keyFromSecret(secret);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(rawKey, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${toB64Url(iv)}.${toB64Url(tag)}.${toB64Url(encrypted)}`;
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

