import { z } from "zod";

export const castMemberAvailabilityTypeSchema = z.enum([
  "AVAILABLE",
  "UNAVAILABLE",
  "BLOCKED",
]);

export const castMemberAvailabilityCreateSchema = z
  .object({
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    type: castMemberAvailabilityTypeSchema,
    notes: z.union([z.string().max(2000), z.null(), z.literal("")]).optional(),
  })
  .strict()
  .refine(
    (data) => {
      const s = new Date(data.startAt).getTime();
      const e = new Date(data.endAt).getTime();
      return !Number.isNaN(s) && !Number.isNaN(e) && s < e;
    },
    { message: "startAt deve ser anterior a endAt", path: ["endAt"] },
  );

export const castMemberAvailabilityPatchSchema = z
  .object({
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
    type: castMemberAvailabilityTypeSchema.optional(),
    notes: z.union([z.string().max(2000), z.null(), z.literal("")]).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe ao menos um campo para atualização",
  });

export type CastMemberAvailabilityCreateData = z.output<
  typeof castMemberAvailabilityCreateSchema
>;
export type CastMemberAvailabilityPatchData = z.output<
  typeof castMemberAvailabilityPatchSchema
>;
