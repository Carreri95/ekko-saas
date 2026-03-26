import type { CastMemberAvailabilityDto } from "@/app/types/cast-member-availability";
import type { RecordingSessionDto } from "@/app/types/recording-session";

export type SessionTimeSuggestion = {
  startIso: string;
  endIso: string;
  label: string;
};

/** Intervalo meia-aberto [t0, t1) em ms desde epoch. */
type Interval = { t0: number; t1: number };

const QUARTER_MS = 15 * 60 * 1000;
const MAX_SUGGESTIONS = 5;
const DEFAULT_DURATION_MS = 60 * 60 * 1000;

function localDayHalfOpen(ymd: string): Interval | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const t0 = new Date(`${ymd}T00:00:00`).getTime();
  if (Number.isNaN(t0)) return null;
  const end = new Date(t0);
  end.setDate(end.getDate() + 1);
  return { t0, t1: end.getTime() };
}

function atLocalTime(ymd: string, hour: number, minute: number): number {
  const d = new Date(`${ymd}T00:00:00`);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

function roundUpToQuarterWallClock(ts: number): number {
  const d = new Date(ts);
  d.setSeconds(0, 0);
  const m = d.getMinutes();
  const rem = m % 15;
  const add = rem === 0 ? 0 : 15 - rem;
  d.setMinutes(m + add);
  const out = d.getTime();
  return out < ts ? out + QUARTER_MS : out;
}

function mergeIntervals(ivs: Interval[]): Interval[] {
  if (!ivs.length) return [];
  const sorted = [...ivs].sort((a, b) => a.t0 - b.t0);
  const out: Interval[] = [];
  let cur = { ...sorted[0] };
  for (let i = 1; i < sorted.length; i++) {
    const n = sorted[i];
    if (n.t0 < cur.t1) cur.t1 = Math.max(cur.t1, n.t1);
    else {
      out.push(cur);
      cur = { ...n };
    }
  }
  out.push(cur);
  return out;
}

function clipIntervalToRange(
  s: number,
  e: number,
  day: Interval,
): Interval | null {
  const t0 = Math.max(s, day.t0);
  const t1 = Math.min(e, day.t1);
  if (t0 < t1) return { t0, t1 };
  return null;
}

function freeGapsInRegion(
  region: Interval,
  blockedMerged: Interval[],
): Interval[] {
  let x = region.t0;
  const gaps: Interval[] = [];
  for (const b of blockedMerged) {
    if (b.t1 <= region.t0) continue;
    if (b.t0 >= region.t1) break;
    const bs = Math.max(b.t0, region.t0);
    const be = Math.min(b.t1, region.t1);
    if (x < bs) gaps.push({ t0: x, t1: bs });
    x = Math.max(x, be);
    if (x >= region.t1) return gaps;
  }
  if (x < region.t1) gaps.push({ t0: x, t1: region.t1 });
  return gaps;
}

function formatSuggestionLabel(startMs: number, endMs: number): string {
  const opt: Intl.DateTimeFormatOptions = {
    hour: "2-digit",
    minute: "2-digit",
  };
  const a = new Intl.DateTimeFormat("pt-BR", opt).format(new Date(startMs));
  const b = new Intl.DateTimeFormat("pt-BR", opt).format(new Date(endMs));
  return `${a} – ${b}`;
}

/**
 * Sugestões simples de início/fim no dia âncora, sem otimização global.
 * Prioriza janelas AVAILABLE; sem cadastro de disponibilidade usa 08h–20h locais.
 */
export function computeSessionTimeSuggestions(input: {
  anchorDateYmd: string;
  durationMs: number;
  castMemberId: string;
  sessions: RecordingSessionDto[];
  availabilities: CastMemberAvailabilityDto[] | undefined;
  excludeSessionId?: string | null;
  /** Início mínimo (ex.: agora, se o dia âncora for hoje). */
  minStartMs?: number;
}): SessionTimeSuggestion[] {
  const day = localDayHalfOpen(input.anchorDateYmd);
  if (!day) return [];

  const duration =
    Number.isFinite(input.durationMs) && input.durationMs >= 60 * 1000
      ? input.durationMs
      : DEFAULT_DURATION_MS;

  const minStart =
    typeof input.minStartMs === "number" && Number.isFinite(input.minStartMs)
      ? input.minStartMs
      : day.t0;

  const rows = input.availabilities ?? [];

  const availableRaw: Interval[] = [];
  const blockedRaw: Interval[] = [];

  for (const a of rows) {
    if (a.castMemberId !== input.castMemberId) continue;
    const a0 = new Date(a.startAt).getTime();
    const a1 = new Date(a.endAt).getTime();
    if (Number.isNaN(a0) || Number.isNaN(a1) || a0 >= a1) continue;
    const clipped = clipIntervalToRange(a0, a1, day);
    if (!clipped) continue;
    if (a.type === "AVAILABLE") availableRaw.push(clipped);
    else if (a.type === "UNAVAILABLE" || a.type === "BLOCKED")
      blockedRaw.push(clipped);
  }

  for (const s of input.sessions) {
    if (s.castMemberId !== input.castMemberId) continue;
    if (input.excludeSessionId && s.id === input.excludeSessionId) continue;
    const s0 = new Date(s.startAt).getTime();
    const s1 = new Date(s.endAt).getTime();
    if (Number.isNaN(s0) || Number.isNaN(s1) || s0 >= s1) continue;
    const clipped = clipIntervalToRange(s0, s1, day);
    if (clipped) blockedRaw.push(clipped);
  }

  const blockedMerged = mergeIntervals(blockedRaw);

  let searchRegions: Interval[];
  if (availableRaw.length > 0) {
    searchRegions = mergeIntervals(availableRaw);
  } else {
    const ymd = input.anchorDateYmd;
    const r0 = atLocalTime(ymd, 8, 0);
    const r1 = atLocalTime(ymd, 20, 0);
    const clipped = clipIntervalToRange(r0, r1, day);
    searchRegions = clipped ? [clipped] : [];
  }

  const allGaps: Interval[] = [];
  for (const region of searchRegions) {
    const gaps = freeGapsInRegion(region, blockedMerged);
    for (const g of gaps) allGaps.push(g);
  }

  allGaps.sort((a, b) => a.t0 - b.t0);

  const usedStarts = new Set<number>();
  const out: SessionTimeSuggestion[] = [];

  const tryPushInGap = (gap: Interval, offsetMs: number) => {
    const raw = gap.t0 + offsetMs;
    const base = Math.max(raw, minStart, gap.t0);
    const aligned = roundUpToQuarterWallClock(base);
    if (aligned < minStart) return;
    if (aligned < gap.t0) return;
    const endMs = aligned + duration;
    if (endMs > gap.t1 || endMs > day.t1) return;
    if (usedStarts.has(aligned)) return;
    usedStarts.add(aligned);
    out.push({
      startIso: new Date(aligned).toISOString(),
      endIso: new Date(endMs).toISOString(),
      label: formatSuggestionLabel(aligned, endMs),
    });
  };

  for (const gap of allGaps) {
    tryPushInGap(gap, 0);
    if (out.length >= MAX_SUGGESTIONS) break;
  }

  if (out.length < MAX_SUGGESTIONS) {
    const EXTRA_OFFSET_MS = 90 * 60 * 1000;
    for (const gap of allGaps) {
      tryPushInGap(gap, EXTRA_OFFSET_MS);
      if (out.length >= MAX_SUGGESTIONS) break;
    }
  }

  return out.slice(0, MAX_SUGGESTIONS);
}
