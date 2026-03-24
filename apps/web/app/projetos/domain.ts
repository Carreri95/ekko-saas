/**
 * Alinhado ao Prisma (`DubbingProjectStatus`, `PaymentType`) — só tipos/constantes,
 * sem importar `@/app/generated/prisma` (incompatível com Client Components).
 */

export type DubbingProjectStatus =
  | "SPOTTING"
  | "ADAPTATION"
  | "REVIEW"
  | "RECORDING"
  | "DELIVERY"
  | "DONE"
  | "PAUSED";

export type PaymentType = "PER_PROJECT" | "PER_EPISODE" | "PER_MINUTE";

/** Moeda do valor do projeto (Prisma `ValueCurrency`). */
export type ValueCurrency = "BRL" | "USD";

export const DEFAULT_DUBBING_STATUS: DubbingProjectStatus = "SPOTTING";
export const DEFAULT_PAYMENT_TYPE: PaymentType = "PER_PROJECT";
