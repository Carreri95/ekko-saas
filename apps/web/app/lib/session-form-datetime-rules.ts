import { composeDateAndTimeToIso } from "@/app/lib/session-datetime";

/** Duração máxima (alinhada à API). */
export const MAX_SESSION_DURATION_MS = 5 * 60 * 60 * 1000;

function parseLocalMs(dateYmd: string, hour24: string, minute: string): number | null {
  const iso = composeDateAndTimeToIso(dateYmd, hour24, minute);
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
}

function endOfSameDayMs(dateYmd: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateYmd)) return null;
  const d = new Date(`${dateYmd}T23:59:59.999`);
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

/** Limite superior do fim: min(início + 5h, 23:59:59.999 do mesmo dia). A regra de 5h na API é a que encerra o intervalo útil (≤ 10h da especificação). */
export function maxSessionEndMs(startDate: string, startHour24: string, startMinute: string): number | null {
  const startMs = parseLocalMs(startDate, startHour24, startMinute);
  if (startMs == null) return null;
  const eod = endOfSameDayMs(startDate);
  if (eod == null) return null;
  return Math.min(startMs + MAX_SESSION_DURATION_MS, eod);
}

export function formatYmdToPt(ymd: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return ymd;
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

/** Horas HH com pelo menos um minuto válido no mesmo dia e dentro dos limites. */
export function validEndHourOptions(
  startDate: string,
  startHour24: string,
  startMinute: string,
): string[] {
  const startMs = parseLocalMs(startDate, startHour24, startMinute);
  const maxEnd = maxSessionEndMs(startDate, startHour24, startMinute);
  if (startMs == null || maxEnd == null || maxEnd <= startMs) return [];

  const hours = new Set<string>();
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, "0");
    for (let mi = 0; mi < 60; mi++) {
      const mm = String(mi).padStart(2, "0");
      const t = parseLocalMs(startDate, hh, mm);
      if (t == null) continue;
      if (t > startMs && t <= maxEnd) {
        hours.add(hh);
        break;
      }
    }
  }
  return [...hours].sort();
}

/** Minutos válidos para a hora de fim escolhida. */
export function validEndMinuteOptions(
  startDate: string,
  startHour24: string,
  startMinute: string,
  endHour24: string,
): string[] {
  const startMs = parseLocalMs(startDate, startHour24, startMinute);
  const maxEnd = maxSessionEndMs(startDate, startHour24, startMinute);
  if (startMs == null || maxEnd == null || maxEnd <= startMs) return [];

  const minutes: string[] = [];
  for (let mi = 0; mi < 60; mi++) {
    const mm = String(mi).padStart(2, "0");
    const t = parseLocalMs(startDate, endHour24, mm);
    if (t == null) continue;
    if (t > startMs && t <= maxEnd) minutes.push(mm);
  }
  return minutes;
}

export type SessionEndParts = {
  endDate: string;
  endHour24: string;
  endMinute: string;
};

/**
 * Garante fim no mesmo dia do início e dentro dos limites.
 * Se o fim actual for inválido, escolhe o primeiro horário válido (mais cedo possível após o início).
 */
export function clampSessionEndToBounds(input: {
  startDate: string;
  startHour24: string;
  startMinute: string;
  endHour24: string;
  endMinute: string;
}): SessionEndParts & { adjusted: boolean } {
  const endDate = input.startDate;
  const startMs = parseLocalMs(input.startDate, input.startHour24, input.startMinute);
  const maxEnd = maxSessionEndMs(input.startDate, input.startHour24, input.startMinute);

  if (startMs == null || maxEnd == null || maxEnd <= startMs) {
    return {
      endDate,
      endHour24: input.endHour24,
      endMinute: input.endMinute,
      adjusted: false,
    };
  }

  const cur = parseLocalMs(endDate, input.endHour24, input.endMinute);
  if (cur != null && cur > startMs && cur <= maxEnd) {
    return {
      endDate,
      endHour24: input.endHour24,
      endMinute: input.endMinute,
      adjusted: false,
    };
  }

  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, "0");
    for (let mi = 0; mi < 60; mi++) {
      const mm = String(mi).padStart(2, "0");
      const t = parseLocalMs(endDate, hh, mm);
      if (t == null) continue;
      if (t > startMs && t <= maxEnd) {
        return { endDate, endHour24: hh, endMinute: mm, adjusted: true };
      }
    }
  }

  return {
    endDate,
    endHour24: input.endHour24,
    endMinute: input.endMinute,
    adjusted: false,
  };
}
