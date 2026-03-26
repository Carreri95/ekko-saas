/** Espelha o enum Prisma `Role` em `apps/api` — para contratos UI/API sem depender do client gerado. */
export const Role = {
  ADMIN: "ADMIN",
  USER: "USER",
} as const;

export type Role = (typeof Role)[keyof typeof Role];
