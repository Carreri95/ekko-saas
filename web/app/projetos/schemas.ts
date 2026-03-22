import { z } from "zod";

const paymentTypeEnum = z.enum(["PER_PROJECT", "PER_EPISODE", "PER_MINUTE"]);

const valueCurrencyEnum = z.enum(["BRL", "USD"]);

export const dubbingProjectStatusEnum = z.enum([
  "SPOTTING",
  "ADAPTATION",
  "REVIEW",
  "RECORDING",
  "DELIVERY",
  "DONE",
  "PAUSED",
]);

/** PATCH / formulário legado: `""` ou `null` para limpar datas. */
const dateStrLoose = z.union([
  z.null(),
  z.literal(""),
  z.string().regex(
    /^\d{4}-\d{2}-\d{2}$/,
    "Data inválida — use o formato dd/mm/aaaa",
  ),
]);

const optionalIntEpisodes = z
  .union([
    z.literal(""),
    z.coerce
      .number()
      .int("O número de episódios deve ser um número inteiro")
      .min(1, "O número de episódios deve ser pelo menos 1"),
  ])
  .transform((v) => (v === "" ? undefined : v));

const optionalIntDurationMin = z
  .union([
    z.literal(""),
    z.coerce
      .number()
      .int("A minutagem deve ser um número inteiro")
      .min(1, "A minutagem deve ser pelo menos 1 minuto"),
  ])
  .transform((v) => (v === "" ? undefined : v));

const optionalFloatMin0 = z
  .union([z.literal(""), z.coerce.number()])
  .transform((v) => (v === "" ? undefined : v))
  .pipe(
    z.union([
      z.undefined(),
      z.number().min(0, "O valor não pode ser negativo"),
    ]),
  );

/** Criação + drawer: datas ISO obrigatórias. */
const requiredIsoDate = (emptyMsg: string) =>
  z
    .string()
    .min(1, emptyMsg)
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida — use o formato dd/mm/aaaa");

const requiredIntEpisodes = z
  .union([
    z.literal(""),
    z.coerce
      .number()
      .int("O número de episódios deve ser um número inteiro")
      .min(1, "O número de episódios deve ser pelo menos 1"),
  ])
  .transform((v) => (v === "" ? undefined : v))
  .pipe(
    z
      .number({
        error: (issue) =>
          issue.input === undefined
            ? { message: "O número de episódios é obrigatório" }
            : { message: issue.message ?? "Inválido" },
      })
      .int("O número de episódios deve ser um número inteiro")
      .min(1, "O número de episódios deve ser pelo menos 1"),
  );

const requiredIntDurationMin = z
  .union([
    z.literal(""),
    z.coerce
      .number()
      .int("A minutagem deve ser um número inteiro")
      .min(1, "A minutagem deve ser pelo menos 1 minuto"),
  ])
  .transform((v) => (v === "" ? undefined : v))
  .pipe(
    z
      .number({
        error: (issue) =>
          issue.input === undefined
            ? { message: "A minutagem total é obrigatória" }
            : { message: issue.message ?? "Inválido" },
      })
      .int("A minutagem deve ser um número inteiro")
      .min(1, "A minutagem deve ser pelo menos 1 minuto"),
  );

const requiredValue = z
  .union([z.literal(""), z.coerce.number()])
  .transform((v) => (v === "" ? undefined : v))
  .pipe(
    z
      .number({
        error: (issue) =>
          issue.input === undefined
            ? { message: "O valor a receber é obrigatório" }
            : { message: issue.message ?? "Inválido" },
      })
      .min(0, "O valor não pode ser negativo"),
  );

/** Comparação ISO YYYY-MM-DD por string é segura. */
function deadlineAfterStart(data: {
  startDate: string | null | undefined;
  deadline: string | null | undefined;
}) {
  const s = data.startDate;
  const d = data.deadline;
  if (
    s === undefined ||
    s === null ||
    s === "" ||
    d === undefined ||
    d === null ||
    d === ""
  ) {
    return true;
  }
  return d >= s;
}

const dateOrderRefine = {
  message: "O prazo de entrega não pode ser anterior à data de início",
  path: ["deadline"],
};

/**
 * PATCH + atualizações parciais: campos opcionais / null como antes.
 */
const dubbingProjectPatchFields = z.object({
  name: z
    .string()
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .min(1, "O nome do projeto é obrigatório")
        .max(120, "O nome não pode ter mais de 120 caracteres"),
    ),

  client: z.union([
    z.literal(""),
    z.string().max(120, "O nome do cliente não pode ter mais de 120 caracteres"),
  ]),

  clientId: z
    .preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : v),
      z.union([z.string().min(1), z.null()]).optional(),
    )
    .optional(),

  startDate: dateStrLoose,
  deadline: dateStrLoose,

  episodes: optionalIntEpisodes,
  durationMin: optionalIntDurationMin,

  language: z.string().min(1, "Selecione o idioma original"),

  value: optionalFloatMin0,

  valueCurrency: valueCurrencyEnum.optional(),

  paymentType: paymentTypeEnum.optional(),

  notes: z
    .union([
      z.null(),
      z.literal(""),
      z.string().max(2000, "As observações não podem ter mais de 2000 caracteres"),
    ])
    .optional(),
});

/**
 * Criação + React Hook Form: todos os campos obrigatórios (exceto `notes`).
 */
const dubbingProjectCreateFields = z.object({
  name: z
    .string()
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .min(1, "O nome do projeto é obrigatório")
        .max(120, "O nome não pode ter mais de 120 caracteres"),
    ),

  client: z
    .string()
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .min(1, "O cliente / contratante é obrigatório")
        .max(120, "O nome do cliente não pode ter mais de 120 caracteres"),
    ),

  clientId: z
    .preprocess(
      (v) => (v === "" || v === null || v === undefined ? null : v),
      z.union([z.string().min(1), z.null()]).optional(),
    )
    .optional(),

  startDate: requiredIsoDate("A data de início é obrigatória"),
  deadline: requiredIsoDate("O prazo de entrega é obrigatório"),

  episodes: requiredIntEpisodes,
  durationMin: requiredIntDurationMin,

  language: z.string().min(1, "O idioma original é obrigatório"),

  value: requiredValue,

  valueCurrency: valueCurrencyEnum.default("BRL"),

  paymentType: paymentTypeEnum.default("PER_PROJECT"),

  notes: z
    .union([
      z.literal(""),
      z.string().max(2000, "As observações não podem ter mais de 2000 caracteres"),
    ])
    .optional(),
});

/**
 * Formulário + POST `/api/dubbing-projects` (sem `status` — SPOTTING no servidor).
 */
export const dubbingProjectFormSchema = dubbingProjectCreateFields.refine(
  deadlineAfterStart,
  dateOrderRefine,
);

/**
 * Edição na página `/projetos/[id]`: mesmos campos obrigatórios que o create + `status`.
 */
export const dubbingProjectEditFormSchema = dubbingProjectCreateFields
  .extend({
    status: dubbingProjectStatusEnum,
  })
  .refine(deadlineAfterStart, dateOrderRefine);

/** PATCH: mesmas chaves que o form, com `status`; `.partial()` no handler. */
export const dubbingProjectSchema = dubbingProjectPatchFields
  .extend({
    status: dubbingProjectStatusEnum.default("SPOTTING"),
  })
  .refine(deadlineAfterStart, dateOrderRefine);

/**
 * Corpo PATCH `/api/dubbing-projects/[id]`: todos os campos opcionais.
 * Não usar `.refine()` aqui — o Zod não permite `.partial()` em schemas com refinements.
 * A ordem início ≤ prazo é validada no handler após merge com o registo existente.
 */
export const dubbingProjectPatchRequestSchema = dubbingProjectPatchFields
  .extend({
    status: dubbingProjectStatusEnum.optional(),
  })
  .partial();

export type DubbingProjectFormInput = z.input<typeof dubbingProjectFormSchema>;
export type DubbingProjectFormData = z.output<typeof dubbingProjectFormSchema>;
export type DubbingProjectEditFormInput = z.input<
  typeof dubbingProjectEditFormSchema
>;
export type DubbingProjectEditFormData = z.output<
  typeof dubbingProjectEditFormSchema
>;
export type DubbingProjectPayload = z.output<typeof dubbingProjectSchema>;

/** Drawer de personagem do projeto (`/projetos/[id]`, aba Elenco). */
export const projectCharacterFormSchema = z.object({
  name: z
    .string()
    .transform((s) => s.trim())
    .pipe(
      z
        .string()
        .min(1, "Nome do personagem é obrigatório")
        .max(80, "O nome não pode ter mais de 80 caracteres"),
    ),

  type: z
    .union([
      z.literal(""),
      z.string().max(60, "Tipo não pode ter mais de 60 caracteres"),
    ])
    .optional(),

  voiceType: z
    .union([
      z.literal(""),
      z.string().max(60, "Tipo de voz não pode ter mais de 60 caracteres"),
    ])
    .optional(),

  importance: z.enum(["MAIN", "SUPPORT", "EXTRA"]).default("SUPPORT"),

  castMemberId: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.union([z.string().min(1), z.null()]).optional(),
  ),

  notes: z
    .union([
      z.literal(""),
      z.string().max(500, "Observações não podem ter mais de 500 caracteres"),
    ])
    .optional(),
});

export type ProjectCharacterFormInput = z.input<
  typeof projectCharacterFormSchema
>;
export type ProjectCharacterFormData = z.output<
  typeof projectCharacterFormSchema
>;
