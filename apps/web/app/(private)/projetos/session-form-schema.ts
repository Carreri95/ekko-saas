import { z } from "zod";
import { composeDateAndTimeToIso } from "@/app/lib/session-datetime";
import { MAX_SESSION_DURATION_MS } from "@/app/lib/session-form-datetime-rules";
import type {
  RecordingSessionFormat,
  RecordingSessionStatus,
} from "@/app/types/recording-session";

export type SessionFormFields = {
  title: string;
  castMemberId: string;
  recordingTechnicianId: string;
  startDate: string;
  startHour24: string;
  startMinute: string;
  endDate: string;
  endHour24: string;
  endMinute: string;
  status: RecordingSessionStatus;
  format: RecordingSessionFormat;
  notes: string;
  episodeIds: string[];
  characterId: string;
};

const sessionStatusEnum = z.enum([
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELED",
]);

const sessionFormatEnum = z.enum(["REMOTE", "IN_PERSON"]);

export const sessionFormSaveSchema = z
  .object({
    title: z.string(),
    castMemberId: z.string(),
    recordingTechnicianId: z.string(),
    startDate: z.string(),
    startHour24: z.string(),
    startMinute: z.string(),
    endDate: z.string(),
    endHour24: z.string(),
    endMinute: z.string(),
    status: sessionStatusEnum,
    format: sessionFormatEnum,
    notes: z.string(),
    episodeIds: z.array(z.string()),
    characterId: z.string(),
  })
  .superRefine((data, ctx) => {
    if (!data.title.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["title"],
        message: "Informe o título da sessão.",
      });
    }
    if (!data.castMemberId.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["castMemberId"],
        message: "Selecione o dublador.",
      });
    }

    const startIso = composeDateAndTimeToIso(
      data.startDate,
      data.startHour24,
      data.startMinute,
    );
    const endIso = composeDateAndTimeToIso(
      data.startDate,
      data.endHour24,
      data.endMinute,
    );
    if (!startIso || !endIso) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message: "Informe início e fim válidos.",
      });
      return;
    }

    if (data.endDate !== data.startDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "O fim deve ser no mesmo dia do início.",
      });
    }

    const t0 = new Date(startIso).getTime();
    const t1 = new Date(endIso).getTime();
    if (!(t1 > t0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "O horário de fim deve ser depois do início.",
      });
    } else if (t1 - t0 > MAX_SESSION_DURATION_MS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "Duração máxima: 5 horas no mesmo dia.",
      });
    }
  });

export type SessionFormSaveParsed = z.infer<typeof sessionFormSaveSchema>;

export function parseSessionFormForSave(form: SessionFormFields) {
  return sessionFormSaveSchema.safeParse(form);
}

export function sessionFormToApiPayload(
  form: SessionFormFields,
  startIso: string,
  endIso: string,
) {
  const tech = form.recordingTechnicianId.trim();
  return {
    title: form.title.trim(),
    castMemberId: form.castMemberId,
    recordingTechnicianId: tech.length > 0 ? tech : null,
    startAt: startIso,
    endAt: endIso,
    status: form.status,
    format: form.format,
    notes: form.notes.trim() ? form.notes.trim() : null,
    characterId: form.characterId.trim() ? form.characterId : null,
    episodeIds: form.episodeIds,
  };
}
