/** Erros típicos quando o Postgres não está acessível ou DATABASE_URL está errado. */
export function isDatabaseConnectionError(error: unknown): boolean {
  if (error === null || error === undefined) return false;
  const any = error as Record<string, unknown>;
  if (typeof any.code === "string") {
    if (any.code === "P1001" || any.code === "ECONNREFUSED") return true;
  }
  const name = typeof any.name === "string" ? any.name : "";
  if (name === "PrismaClientInitializationError") return true;
  const msg = String(any.message ?? error);
  if (
    /ECONNREFUSED|Can't reach database|P1001|connection refused|connect ECONNREFUSED/i.test(
      msg,
    )
  ) {
    return true;
  }
  return false;
}
