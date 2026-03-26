export type SessionDatetimeParts = {
  dateYmd: string;
  hour24: string;
  minute: string;
};

export function emptySessionDatetimeParts(): SessionDatetimeParts {
  return {
    dateYmd: "",
    hour24: "00",
    minute: "00",
  };
}

/** Data local yyyy-MM-dd a partir de ISO (para DateInput). */
export function isoToDateInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function isoToTimeInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Interpreta "HH:mm" (24h) em partes normalizadas. */
export function parseHourMinuteFromTime24(time24: string): {
  hour24: string;
  minute: string;
} {
  const [hRaw, mRaw] = time24.split(":");
  const hNum = Number(hRaw);
  const mNum = Number(mRaw);
  if (!Number.isFinite(hNum) || !Number.isFinite(mNum)) {
    return { hour24: "00", minute: "00" };
  }
  const h = Math.max(0, Math.min(23, Math.trunc(hNum)));
  const m = Math.max(0, Math.min(59, Math.trunc(mNum)));
  return {
    hour24: String(h).padStart(2, "0"),
    minute: String(m).padStart(2, "0"),
  };
}

export function composeDateAndTimeToIso(
  dateYmd: string,
  hour24: string,
  minute: string,
): string {
  if (!dateYmd || !hour24 || !minute) return "";
  const hNum = Number(hour24);
  const mNum = Number(minute);
  if (!Number.isFinite(hNum) || !Number.isFinite(mNum)) return "";
  if (hNum < 0 || hNum > 23 || mNum < 0 || mNum > 59) return "";
  const hh = String(hNum).padStart(2, "0");
  const mm = String(mNum).padStart(2, "0");
  const d = new Date(`${dateYmd}T${hh}:${mm}:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

export function partsFromIso(iso: string): SessionDatetimeParts {
  const t = isoToTimeInput(iso);
  const hm = parseHourMinuteFromTime24(t);
  return {
    dateYmd: isoToDateInput(iso),
    hour24: hm.hour24,
    minute: hm.minute,
  };
}
