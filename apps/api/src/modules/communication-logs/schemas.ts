import { z } from "zod";

export const communicationChannelSchema = z.enum(["EMAIL", "WHATSAPP", "SYSTEM"]);
export const communicationDirectionSchema = z.enum(["OUTBOUND", "INBOUND"]);
export const communicationStatusSchema = z.enum([
  "PENDING",
  "PROCESSING",
  "SENT",
  "RECEIVED",
  "FAILED",
]);

const optionalNullableId = z
  .union([z.string().min(1), z.null(), z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v));

const optionalNullableString = z
  .union([z.string(), z.null(), z.literal("")])
  .optional()
  .transform((v) => (v === "" || v === undefined ? undefined : v));

const optionalNullableSentAt = z
  .union([z.string().datetime(), z.null(), z.literal("")])
  .optional()
  .transform((v) => {
    if (v === "" || v === undefined) return undefined;
    if (v === null) return null;
    return v;
  });

export const communicationLogCreateSchema = z
  .object({
    channel: communicationChannelSchema,
    direction: communicationDirectionSchema,
    status: communicationStatusSchema,
    subject: optionalNullableString,
    body: z.string().trim().min(1).max(50_000),
    templateKey: optionalNullableString,
    recipientName: optionalNullableString,
    recipientEmail: optionalNullableString,
    recipientWhatsapp: optionalNullableString,
    episodeId: optionalNullableId,
    castMemberId: optionalNullableId,
    clientId: optionalNullableId,
    sessionId: optionalNullableId,
    sentAt: optionalNullableSentAt,
    error: optionalNullableString,
  })
  .strict();

export const communicationLogPatchSchema = z
  .object({
    channel: communicationChannelSchema.optional(),
    direction: communicationDirectionSchema.optional(),
    status: communicationStatusSchema.optional(),
    subject: optionalNullableString,
    body: z.string().trim().min(1).max(50_000).optional(),
    templateKey: optionalNullableString,
    recipientName: optionalNullableString,
    recipientEmail: optionalNullableString,
    recipientWhatsapp: optionalNullableString,
    episodeId: optionalNullableId,
    castMemberId: optionalNullableId,
    clientId: optionalNullableId,
    sessionId: optionalNullableId,
    sentAt: optionalNullableSentAt,
    error: optionalNullableString,
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Informe ao menos um campo para atualização",
  });

export type CommunicationLogCreateData = z.output<typeof communicationLogCreateSchema>;
export type CommunicationLogPatchData = z.output<typeof communicationLogPatchSchema>;
