import { z } from "zod";

export const recordingSessionStatusSchema = z.enum([
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELED",
]);

export const recordingSessionFormatSchema = z.enum(["REMOTE", "IN_PERSON"]);

const optionalNullableId = z
  .union([z.string().min(1), z.null(), z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v));

const episodeIdsArray = z.array(z.string().min(1)).max(100);

export const recordingSessionCreateSchema = z
  .object({
    castMemberId: z.string().min(1),
    recordingTechnicianId: optionalNullableId,
    /// Legado: um episódio. Preferir `episodeIds`.
    episodeId: optionalNullableId,
    episodeIds: episodeIdsArray.optional(),
    characterId: optionalNullableId,
    title: z.string().trim().min(1).max(200),
    startAt: z.string().datetime(),
    endAt: z.string().datetime(),
    status: recordingSessionStatusSchema.default("PENDING"),
    format: recordingSessionFormatSchema,
    notes: z.union([z.string().max(2000), z.null(), z.literal("")]).optional(),
  })
  .strict();

export const recordingSessionPatchSchema = z
  .object({
    castMemberId: z.string().min(1).optional(),
    recordingTechnicianId: optionalNullableId,
    episodeId: optionalNullableId,
    episodeIds: episodeIdsArray.optional(),
    characterId: optionalNullableId,
    title: z.string().trim().min(1).max(200).optional(),
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
    status: recordingSessionStatusSchema.optional(),
    format: recordingSessionFormatSchema.optional(),
    notes: z.union([z.string().max(2000), z.null(), z.literal("")]).optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe ao menos um campo para atualização",
  });

export type RecordingSessionCreateData = z.output<typeof recordingSessionCreateSchema>;
export type RecordingSessionPatchData = z.output<typeof recordingSessionPatchSchema>;
