import { z } from "zod";

export const dubbingProjectStatusEnum = z.enum([
  "SPOTTING",
  "ADAPTATION",
  "REVIEW",
  "RECORDING",
  "DELIVERY",
  "DONE",
  "PAUSED",
]);

const paymentTypeEnum = z.enum(["PER_PROJECT", "PER_EPISODE", "PER_MINUTE"]);
const valueCurrencyEnum = z.enum(["BRL", "USD"]);

const dateStrLoose = z.union([
  z.null(),
  z.literal(""),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida"),
]);

const optionalIntEpisodes = z
  .union([z.literal(""), z.coerce.number().int().min(1)])
  .transform((v) => (v === "" ? undefined : v));

const optionalIntDurationMin = z
  .union([z.literal(""), z.coerce.number().int().min(1)])
  .transform((v) => (v === "" ? undefined : v));

const optionalFloatMin0 = z
  .union([z.literal(""), z.coerce.number()])
  .transform((v) => (v === "" ? undefined : v))
  .pipe(z.union([z.undefined(), z.number().min(0)]));

const requiredIsoDate = z.string().min(1).regex(/^\d{4}-\d{2}-\d{2}$/);

const requiredIntEpisodes = z
  .union([z.literal(""), z.coerce.number().int().min(1)])
  .transform((v) => (v === "" ? undefined : v))
  .pipe(z.number().int().min(1));

const requiredIntDurationMin = z
  .union([z.literal(""), z.coerce.number().int().min(1)])
  .transform((v) => (v === "" ? undefined : v))
  .pipe(z.number().int().min(1));

const requiredValue = z
  .union([z.literal(""), z.coerce.number()])
  .transform((v) => (v === "" ? undefined : v))
  .pipe(z.number().min(0));

function deadlineAfterStart(data: { startDate: string | null | undefined; deadline: string | null | undefined }) {
  const s = data.startDate;
  const d = data.deadline;
  if (!s || !d) return true;
  return d >= s;
}

const patchFields = z.object({
  name: z.string().transform((s) => s.trim()).pipe(z.string().min(1).max(120)),
  client: z.union([z.literal(""), z.string().max(120)]),
  clientId: z
    .preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.union([z.string().min(1), z.null()]).optional())
    .optional(),
  startDate: dateStrLoose,
  deadline: dateStrLoose,
  episodes: optionalIntEpisodes,
  durationMin: optionalIntDurationMin,
  language: z.string().min(1),
  value: optionalFloatMin0,
  valueCurrency: valueCurrencyEnum.optional(),
  paymentType: paymentTypeEnum.optional(),
  notes: z.union([z.null(), z.literal(""), z.string().max(2000)]).optional(),
});

const createFields = z.object({
  name: z.string().transform((s) => s.trim()).pipe(z.string().min(1).max(120)),
  client: z.string().transform((s) => s.trim()).pipe(z.string().min(1).max(120)),
  clientId: z
    .preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.union([z.string().min(1), z.null()]).optional())
    .optional(),
  startDate: requiredIsoDate,
  deadline: requiredIsoDate,
  episodes: requiredIntEpisodes,
  durationMin: requiredIntDurationMin,
  language: z.string().min(1),
  value: requiredValue,
  valueCurrency: valueCurrencyEnum.default("BRL"),
  paymentType: paymentTypeEnum.default("PER_PROJECT"),
  notes: z.union([z.literal(""), z.string().max(2000)]).optional(),
});

export const dubbingProjectFormSchema = createFields.refine(deadlineAfterStart, {
  message: "O prazo de entrega não pode ser anterior à data de início",
  path: ["deadline"],
});

export const dubbingProjectPatchRequestSchema = patchFields
  .extend({
    status: dubbingProjectStatusEnum.optional(),
  })
  .partial();

const castMemberIdField = z.preprocess(
  (v) => (v === "" ? null : v),
  z.union([z.string().min(1), z.null()]).optional(),
);

function optionalStringField(max: number) {
  return z.preprocess(
    (v) => (v === null || v === undefined ? undefined : v),
    z.union([z.literal(""), z.string().max(max)]).optional(),
  );
}

export const characterCreateSchema = z.object({
  name: z.string().min(1).max(80),
  type: optionalStringField(60),
  voiceType: optionalStringField(60),
  importance: z.enum(["MAIN", "SUPPORT", "EXTRA"]).default("SUPPORT"),
  castMemberId: castMemberIdField,
  notes: optionalStringField(500),
});

export const characterPatchSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  type: optionalStringField(60),
  voiceType: optionalStringField(60),
  importance: z.enum(["MAIN", "SUPPORT", "EXTRA"]).optional(),
  castMemberId: castMemberIdField,
  notes: optionalStringField(500),
});

export type DubbingProjectCreateData = z.output<typeof dubbingProjectFormSchema>;
export type DubbingProjectPatchData = z.output<typeof dubbingProjectPatchRequestSchema>;
export type CharacterCreateData = z.output<typeof characterCreateSchema>;
export type CharacterPatchData = z.output<typeof characterPatchSchema>;
