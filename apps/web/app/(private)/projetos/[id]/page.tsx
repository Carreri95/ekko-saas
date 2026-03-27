"use client";

import "../projetos.css";

import { PageShell } from "@/app/components/page-shell";
import { useConfirm } from "@/app/components/confirm-provider";
import { DateInput } from "@/app/components/date-input";
import { SessionDatetimeField } from "@/app/components/session-datetime-field";
import {
  composeDateAndTimeToIso,
  isoToDateInput,
  partsFromIso,
} from "@/app/lib/session-datetime";
import { computeSessionTimeSuggestions } from "@/app/lib/session-time-suggestions";
import { buildCommunicationFormPrefillFromSession } from "@/app/lib/communication-session-prefill";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  dubbingProjectEditFormSchema,
  type DubbingProjectEditFormData,
  type DubbingProjectEditFormInput,
} from "../schemas";
import type { DubbingProjectDto } from "../types";
import type { DubbingProjectStatus } from "../domain";
import type { ProjectCharacterDto } from "@/app/types/project-character";
import type { CastMemberDto } from "@/app/types/cast-member";
import type { DubbingEpisodeDto } from "@/app/types/dubbing-episode";
import type {
  RecordingSessionDto,
  RecordingSessionFormat,
  RecordingSessionStatus,
} from "@/app/types/recording-session";
import type { CastMemberAvailabilityDto } from "@/app/types/cast-member-availability";
import { CharacterCard } from "./components/character-card";
import { CharacterModal } from "./components/character-modal";
import { LanguageCombobox } from "../components/language-combobox";
import { CurrencyValueField } from "../components/currency-value-field";
import { ProjectStatusStepper } from "../components/project-status-stepper";
import { ClientSelect } from "../components/client-select";
import { ClientQuickModal } from "../components/client-quick-modal";
import {
  contractTotalHint,
  formUnitToStoredTotal,
  normalizeMoneyForStorage,
  storedTotalToFormUnit,
  valueFieldLabel,
} from "../lib/project-finance";
import {
  ProjectCommunicationTab,
  type CommunicationTabDraft,
} from "./components/project-communication-tab";

const TABS = [
  { id: "info", label: "Informações", enabled: true },
  { id: "elenco", label: "Elenco", enabled: true },
  { id: "episodios", label: "Episódios", enabled: true },
  { id: "agenda", label: "Agenda", enabled: true },
  { id: "comunicacao", label: "Comunicação", enabled: true },
  { id: "gravacoes", label: "Gravações", enabled: false },
  { id: "financeiro", label: "Financeiro", enabled: false },
] as const;

type TabId = (typeof TABS)[number]["id"];

const STATUS_LABELS: { value: DubbingProjectStatus; label: string }[] = [
  { value: "SPOTTING", label: "Spotting" },
  { value: "ADAPTATION", label: "Adaptação" },
  { value: "REVIEW", label: "Revisão" },
  { value: "RECORDING", label: "Em gravação" },
  { value: "DELIVERY", label: "Entrega" },
  { value: "DONE", label: "Concluído" },
  { value: "PAUSED", label: "Pausado" },
];

const PAYMENT_OPTIONS = [
  { value: "PER_PROJECT" as const, label: "Valor fixo por projeto" },
  { value: "PER_EPISODE" as const, label: "Por episódio" },
  { value: "PER_MINUTE" as const, label: "Por minuto de áudio" },
];

const inputCls =
  "w-full min-h-[36px] rounded-[6px] border border-[#2e2e2e] bg-[#111] px-[10px] py-[7px] text-[13px] text-[#e8e8e8] outline-none placeholder:text-[#505050] focus:border-[#1D9E75] transition-colors";
const inputErrCls =
  "w-full min-h-[36px] rounded-[6px] border border-[#E24B4A] bg-[#111] px-[10px] py-[7px] text-[13px] text-[#e8e8e8] outline-none focus:border-[#E24B4A] transition-colors";
const labelCls =
  "mb-[5px] block text-[10px] font-[600] uppercase tracking-[0.07em] text-[#505050]";
const errorCls = "mt-[3px] text-[11px] text-[#F09595]";

function getWorkflowBadge(ep: DubbingEpisodeDto): {
  className: string;
  label: string;
  spinning?: boolean;
} {
  if (ep.status === "TRANSCRIBING") {
    return {
      className: "badge-transcribing",
      label: "Em transcrição",
      spinning: true,
    };
  }
  const map: Record<
    typeof ep.workflowState,
    { className: string; label: string }
  > = {
    sem_audio: { className: "badge-no-audio", label: "Sem áudio" },
    audio_enviado: { className: "badge-audio", label: "Áudio enviado" },
    transcrevendo: { className: "badge-transcribing", label: "Transcrevendo" },
    pronto_para_editar: { className: "badge-ready", label: "Pronto p/ editar" },
    em_edicao: { className: "badge-editing", label: "Em edição" },
    concluido: { className: "badge-done", label: "Concluído" },
  };
  return map[ep.workflowState];
}

function formatEpisodeTimestamp(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function isoToInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

type SessionFormState = {
  title: string;
  castMemberId: string;
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

const SESSION_STATUS_OPTIONS: Array<{
  value: RecordingSessionStatus;
  label: string;
}> = [
  { value: "PENDING", label: "Pendente" },
  { value: "CONFIRMED", label: "Confirmada" },
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "COMPLETED", label: "Concluída" },
  { value: "CANCELED", label: "Cancelada" },
];

const SESSION_FORMAT_OPTIONS: Array<{
  value: RecordingSessionFormat;
  label: string;
}> = [
  { value: "REMOTE", label: "Remoto" },
  { value: "IN_PERSON", label: "Presencial" },
];

const EMPTY_SESSION_FORM: SessionFormState = {
  title: "",
  castMemberId: "",
  startDate: "",
  startHour24: "00",
  startMinute: "00",
  endDate: "",
  endHour24: "00",
  endMinute: "00",
  status: "PENDING",
  format: "REMOTE",
  notes: "",
  episodeIds: [],
  characterId: "",
};

const AGENDA_PAGE_SIZE = 8;

type SessionPeriodFilter = "ALL" | "TODAY" | "NEXT_7_DAYS" | "PAST";

function getSessionStatusLabel(status: RecordingSessionStatus): string {
  return (
    SESSION_STATUS_OPTIONS.find((s) => s.value === status)?.label ?? status
  );
}

function getSessionFormatLabel(format: RecordingSessionFormat): string {
  return (
    SESSION_FORMAT_OPTIONS.find((s) => s.value === format)?.label ?? format
  );
}

function getSessionStatusBadgeClass(status: RecordingSessionStatus): string {
  const map: Record<RecordingSessionStatus, string> = {
    PENDING: "border-[#404040] bg-[#2a2a2a] text-[#b5b5b5]",
    CONFIRMED: "border-[#1a4d6e] bg-[#152a3d] text-[#7EC8E3]",
    IN_PROGRESS: "border-[#5c4a20] bg-[#3d3520] text-[#EF9F27]",
    COMPLETED: "border-[#0F6E56] bg-[#0d3d2a] text-[#5DCAA5]",
    CANCELED: "border-[#5a1515] bg-[#2a0a0a] text-[#F09595]",
  };
  return map[status];
}

function getSessionFormatBadgeClass(format: RecordingSessionFormat): string {
  const map: Record<RecordingSessionFormat, string> = {
    REMOTE: "border-[#3d4450] bg-[#2a3140] text-[#A8B4CC]",
    IN_PERSON: "border-[#5c4a20] bg-[#3d3520] text-[#E9C17A]",
  };
  return map[format];
}

function getLocalDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getDayHeaderLabel(dayKey: string, now: Date): string {
  const [yRaw, mRaw, dRaw] = dayKey.split("-").map(Number);
  const date = new Date(yRaw, (mRaw ?? 1) - 1, dRaw ?? 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (getLocalDayKey(date) === getLocalDayKey(today)) return "Hoje";
  if (getLocalDayKey(date) === getLocalDayKey(tomorrow)) return "Amanhã";
  const label = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function isSessionInPeriod(
  iso: string,
  period: SessionPeriodFilter,
  now: Date,
): boolean {
  if (period === "ALL") return true;
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return false;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const next7End = new Date(todayStart);
  next7End.setDate(todayStart.getDate() + 7);
  if (period === "TODAY") {
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(todayStart.getDate() + 1);
    return start >= todayStart && start < tomorrowStart;
  }
  if (period === "NEXT_7_DAYS") {
    return start >= todayStart && start < next7End;
  }
  return start < todayStart;
}

function buildSessionDayGroups(
  sessionList: RecordingSessionDto[],
  now: Date,
): Array<{
  dayKey: string;
  label: string;
  items: RecordingSessionDto[];
}> {
  const groups: Array<{
    dayKey: string;
    label: string;
    items: RecordingSessionDto[];
  }> = [];
  for (const session of sessionList) {
    const dt = new Date(session.startAt);
    if (Number.isNaN(dt.getTime())) continue;
    const dayKey = getLocalDayKey(dt);
    const last = groups[groups.length - 1];
    if (!last || last.dayKey !== dayKey) {
      groups.push({
        dayKey,
        label: getDayHeaderLabel(dayKey, now),
        items: [session],
      });
    } else {
      last.items.push(session);
    }
  }
  return groups;
}

/** Horário local curto para timeline (início – fim). */
function formatSessionTimeRange(startIso: string, endIso: string): string {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (Number.isNaN(s.getTime())) return "—";
  const opts: Intl.DateTimeFormatOptions = { timeStyle: "short" };
  const a = s.toLocaleTimeString("pt-BR", opts);
  if (Number.isNaN(e.getTime())) return a;
  return `${a} – ${e.toLocaleTimeString("pt-BR", opts)}`;
}

/** Sobreposição estrita de intervalos [start, end) em tempo Unix. */
function sessionIntervalsOverlap(
  a: RecordingSessionDto,
  b: RecordingSessionDto,
): boolean {
  const aStart = new Date(a.startAt).getTime();
  const aEnd = new Date(a.endAt).getTime();
  const bStart = new Date(b.startAt).getTime();
  const bEnd = new Date(b.endAt).getTime();
  if (
    Number.isNaN(aStart) ||
    Number.isNaN(aEnd) ||
    Number.isNaN(bStart) ||
    Number.isNaN(bEnd)
  ) {
    return false;
  }
  return aStart < bEnd && bStart < aEnd;
}

/**
 * IDs de sessões em conflito (mesmo dia local + mesmo dublador + intervalos sobrepostos).
 * Agrupa por bucket para evitar O(n²) global; dentro de cada bucket ordena por início e corta o inner loop cedo.
 */
function computeSessionOverlapConflicts(
  sessions: RecordingSessionDto[],
): Set<string> {
  const conflictIds = new Set<string>();
  const buckets = new Map<string, RecordingSessionDto[]>();

  for (const s of sessions) {
    const dt = new Date(s.startAt);
    if (Number.isNaN(dt.getTime())) continue;
    const dayKey = getLocalDayKey(dt);
    const bucketKey = `${dayKey}\0${s.castMemberId}`;
    const list = buckets.get(bucketKey);
    if (list) list.push(s);
    else buckets.set(bucketKey, [s]);
  }

  for (const group of buckets.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort(
      (x, y) =>
        new Date(x.startAt).getTime() - new Date(y.startAt).getTime(),
    );
    for (let i = 0; i < sorted.length; i++) {
      const a = sorted[i];
      const aEnd = new Date(a.endAt).getTime();
      if (Number.isNaN(aEnd)) continue;
      for (let j = i + 1; j < sorted.length; j++) {
        const b = sorted[j];
        const bStart = new Date(b.startAt).getTime();
        if (Number.isNaN(bStart)) continue;
        if (bStart >= aEnd) break;
        if (sessionIntervalsOverlap(a, b)) {
          conflictIds.add(a.id);
          conflictIds.add(b.id);
        }
      }
    }
  }

  return conflictIds;
}

type AgendaConflictType =
  | "SESSION_OVERLAP"
  | "AVAILABILITY_UNAVAILABLE"
  | "AVAILABILITY_BLOCKED";

type AgendaConflictSeverity = "soft" | "medium" | "hard";

/**
 * Resumo único por sessão na agenda filtrada.
 * severidade: soft = sobreposição com outra sessão; medium = UNAVAILABLE; hard = BLOCKED.
 */
type SessionConflictSummary = {
  hasConflict: boolean;
  severity: AgendaConflictSeverity | null;
  types: AgendaConflictType[];
  /** Texto para tooltip (tipos combinados sem segundo badge). */
  detailLines: string[];
};

const EMPTY_SESSION_CONFLICT_SUMMARY: SessionConflictSummary = {
  hasConflict: false,
  severity: null,
  types: [],
  detailLines: [],
};

function sessionConflictSummaryForId(
  map: Map<string, SessionConflictSummary>,
  sessionId: string,
): SessionConflictSummary {
  return map.get(sessionId) ?? EMPTY_SESSION_CONFLICT_SUMMARY;
}

type AgendaDayConflictStats = {
  total: number;
  hard: number;
  medium: number;
};

function dayConflictHeaderAccentClass(stats: AgendaDayConflictStats): string {
  if (stats.total === 0) return "";
  if (stats.hard > 0) return "text-[#F09595]";
  if (stats.medium > 0) return "text-[#E07A2E]";
  return "text-[#c9a227]";
}

/** Sobreposição sessão × período de disponibilidade (UNAVAILABLE / BLOCKED). */
function sessionOverlapsAvailabilityWindow(
  session: RecordingSessionDto,
  a: CastMemberAvailabilityDto,
): boolean {
  if (a.type !== "UNAVAILABLE" && a.type !== "BLOCKED") return false;
  const sStart = new Date(session.startAt).getTime();
  const sEnd = new Date(session.endAt).getTime();
  const aStart = new Date(a.startAt).getTime();
  const aEnd = new Date(a.endAt).getTime();
  if (
    Number.isNaN(sStart) ||
    Number.isNaN(sEnd) ||
    Number.isNaN(aStart) ||
    Number.isNaN(aEnd)
  ) {
    return false;
  }
  return sStart < aEnd && aStart < sEnd;
}

function collectAvailabilityConflictTypes(
  session: RecordingSessionDto,
  rows: CastMemberAvailabilityDto[] | undefined,
): AgendaConflictType[] {
  const out: AgendaConflictType[] = [];
  if (!rows?.length) return out;
  let blocked = false;
  let unavailable = false;
  for (const a of rows) {
    if (!sessionOverlapsAvailabilityWindow(session, a)) continue;
    if (a.type === "BLOCKED") blocked = true;
    else if (a.type === "UNAVAILABLE") unavailable = true;
  }
  if (blocked) out.push("AVAILABILITY_BLOCKED");
  if (unavailable) out.push("AVAILABILITY_UNAVAILABLE");
  return out;
}

function severityFromConflictTypes(
  types: AgendaConflictType[],
): AgendaConflictSeverity | null {
  if (types.includes("AVAILABILITY_BLOCKED")) return "hard";
  if (types.includes("AVAILABILITY_UNAVAILABLE")) return "medium";
  if (types.includes("SESSION_OVERLAP")) return "soft";
  return null;
}

function buildSessionConflictSummary(
  session: RecordingSessionDto,
  hasSessionOverlap: boolean,
  availByMember: Record<string, CastMemberAvailabilityDto[]>,
): SessionConflictSummary {
  const types: AgendaConflictType[] = [];
  const detailLines: string[] = [];
  if (hasSessionOverlap) {
    types.push("SESSION_OVERLAP");
    detailLines.push(
      "Sobreposição de horário com outra sessão deste dublador no mesmo dia.",
    );
  }
  for (const t of collectAvailabilityConflictTypes(
    session,
    availByMember[session.castMemberId],
  )) {
    types.push(t);
    if (t === "AVAILABILITY_BLOCKED") {
      detailLines.push("Cruza período bloqueado no cadastro do dublador.");
    }
    if (t === "AVAILABILITY_UNAVAILABLE") {
      detailLines.push("Cruza período indisponível no cadastro do dublador.");
    }
  }
  const severity = severityFromConflictTypes(types);
  return {
    hasConflict: types.length > 0,
    severity,
    types,
    detailLines,
  };
}

/** Conflito do intervalo do formulário (criação/edição), mesma regra que a agenda. */
function buildConflictSummaryForProposedSession(input: {
  startAt: string;
  endAt: string;
  castMemberId: string;
  excludeSessionId: string | null;
  sessions: RecordingSessionDto[];
  availByMember: Record<string, CastMemberAvailabilityDto[]>;
}): SessionConflictSummary {
  const stub = {
    id: input.excludeSessionId ?? "__proposed__",
    startAt: input.startAt,
    endAt: input.endAt,
    castMemberId: input.castMemberId,
  } as RecordingSessionDto;

  const hasOverlap = input.sessions.some((s) => {
    if (s.castMemberId !== input.castMemberId) return false;
    if (input.excludeSessionId && s.id === input.excludeSessionId) return false;
    return sessionIntervalsOverlap(stub, s);
  });

  return buildSessionConflictSummary(stub, hasOverlap, input.availByMember);
}

function agendaConflictCardClassNames(
  severity: AgendaConflictSeverity | null,
  isEditing: boolean,
): string {
  if (isEditing) {
    return "border-[#1D9E75] bg-[#122a22] ring-1 ring-[#1D9E75]/35";
  }
  switch (severity) {
    case "hard":
      return "border-[#8b3535] bg-[#241414] ring-1 ring-[#E24B4A]/35 hover:border-[#a04040]";
    case "medium":
      return "border-[#a65c18] bg-[#261a0e] ring-1 ring-[#E07A2E]/28 hover:border-[#b86a20]";
    case "soft":
      return "border-[#6b5a1e] bg-[#221f14] ring-1 ring-[#EF9F27]/22 hover:border-[#7d6a28]";
    default:
      return "border-[#252525] bg-[#141414] hover:border-[#333] hover:bg-[#181818]";
  }
}

function agendaConflictBadgePresentation(severity: AgendaConflictSeverity): {
  label: string;
  className: string;
} {
  switch (severity) {
    case "hard":
      return {
        label: "Bloqueado",
        className:
          "inline-flex items-center gap-[4px] rounded-[4px] border border-[#8b3030] bg-[#3d2020] px-[6px] py-[1px] text-[10px] font-[600] uppercase tracking-[0.04em] text-[#F09595]",
      };
    case "medium":
      return {
        label: "Indisponível",
        className:
          "inline-flex items-center gap-[4px] rounded-[4px] border border-[#8a5520] bg-[#3d2a18] px-[6px] py-[1px] text-[10px] font-[600] uppercase tracking-[0.04em] text-[#E07A2E]",
      };
    default:
      return {
        label: "Sobreposição",
        className:
          "inline-flex items-center gap-[4px] rounded-[4px] border border-[#6b5a1e] bg-[#3d3520] px-[6px] py-[1px] text-[10px] font-[600] uppercase tracking-[0.04em] text-[#EF9F27]",
      };
  }
}

function agendaConflictListBadgePresentation(severity: AgendaConflictSeverity): {
  label: string;
  className: string;
} {
  const base =
    "inline-flex items-center gap-[4px] rounded-[10px] border px-[6px] py-[1px] text-[10px] font-[600]";
  switch (severity) {
    case "hard":
      return {
        label: "Bloqueado",
        className: `${base} border-[#8b3030] bg-[#3d2020] text-[#F09595]`,
      };
    case "medium":
      return {
        label: "Indisponível",
        className: `${base} border-[#8a5520] bg-[#3d2a18] text-[#E07A2E]`,
      };
    default:
      return {
        label: "Sobreposição",
        className: `${base} border-[#6b5a1e] bg-[#3d3520] text-[#EF9F27]`,
      };
  }
}

function getEditDefaults(p: DubbingProjectDto): DubbingProjectEditFormInput {
  const unit = storedTotalToFormUnit(
    p.value,
    p.paymentType,
    p.episodes,
    p.durationMin,
  );
  return {
    name: p.name,
    client: p.client?.trim() ? p.client : "",
    clientId: p.clientId ?? null,
    startDate: isoToInput(p.startDate),
    deadline: isoToInput(p.deadline),
    episodes: p.episodes != null ? Number(p.episodes) : "",
    durationMin: p.durationMin != null ? Number(p.durationMin) : "",
    language: p.language ?? "ja",
    value: Number.isFinite(unit) ? unit : "",
    valueCurrency: p.valueCurrency ?? "BRL",
    paymentType: p.paymentType ?? "PER_PROJECT",
    notes: p.notes ?? "",
    status: p.status,
  };
}

export default function ProjectEditPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const confirm = useConfirm();
  const id = typeof params.id === "string" ? params.id : "";

  const [project, setProject] = useState<DubbingProjectDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    const t = searchParams.get("tab");
    if (t === "episodios") return "episodios";
    if (t === "comunicacao") return "comunicacao";
    return "info";
  });
  const [savedMsg, setSavedMsg] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientListRefresh, setClientListRefresh] = useState(0);
  const [characters, setCharacters] = useState<ProjectCharacterDto[]>([]);
  const [castMembers, setCastMembers] = useState<CastMemberDto[]>([]);
  const [charModalOpen, setCharModalOpen] = useState(false);
  const [editingChar, setEditingChar] = useState<ProjectCharacterDto | null>(
    null,
  );
  const [episodes, setEpisodes] = useState<DubbingEpisodeDto[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const [episodesError, setEpisodesError] = useState<string | null>(null);
  const [uploadingEpisodeId, setUploadingEpisodeId] = useState<string | null>(
    null,
  );
  const [episodeInlineError, setEpisodeInlineError] = useState<
    Record<string, string>
  >({});
  const [exportSrtsBusy, setExportSrtsBusy] = useState(false);
  const [exportSrtsError, setExportSrtsError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<RecordingSessionDto[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState<string | null>(null);
  const [sessionForm, setSessionForm] =
    useState<SessionFormState>(EMPTY_SESSION_FORM);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionSaving, setSessionSaving] = useState(false);
  const [sessionDeletingId, setSessionDeletingId] = useState<string | null>(
    null,
  );
  const [sessionFeedback, setSessionFeedback] = useState<string | null>(null);
  const [sessionFeedbackTone, setSessionFeedbackTone] = useState<
    "success" | "error" | "info"
  >("success");
  const [sessionSuggestionAppliedHint, setSessionSuggestionAppliedHint] =
    useState<string | null>(null);
  const [sessionTitleTouched, setSessionTitleTouched] = useState(false);
  const [sessionStatusFilter, setSessionStatusFilter] = useState<
    "ALL" | RecordingSessionStatus
  >("ALL");
  const [sessionCastFilter, setSessionCastFilter] = useState<string>("ALL");
  const [sessionPeriodFilter, setSessionPeriodFilter] =
    useState<SessionPeriodFilter>("ALL");
  const [sessionVisibleCount, setSessionVisibleCount] =
    useState(AGENDA_PAGE_SIZE);
  const [sessionAgendaViewMode, setSessionAgendaViewMode] = useState<
    "list" | "visual"
  >("list");
  const [communicationTabDraft, setCommunicationTabDraft] =
    useState<CommunicationTabDraft | null>(null);
  const [castMemberAvailabilities, setCastMemberAvailabilities] = useState<
    Record<string, CastMemberAvailabilityDto[]>
  >({});
  const agendaAvailabilityFetchedRef = useRef<Set<string>>(new Set());
  const [episodeDropdownOpen, setEpisodeDropdownOpen] = useState(false);
  const audioTargetEpRef = useRef<string | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);
  const episodeDropdownRef = useRef<HTMLDivElement>(null);
  const transcriptionPollRef = useRef<
    Record<string, ReturnType<typeof setInterval>>
  >({});

  const load = useCallback(async () => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/dubbing-projects/${id}`);
      if (!res.ok) {
        setNotFound(true);
        setProject(null);
        return;
      }
      const data = (await res.json()) as { project: DubbingProjectDto };
      setProject(data.project);
    } catch {
      setNotFound(true);
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadCharacters = useCallback(async () => {
    if (!id) return;
    const res = await fetch(`/api/dubbing-projects/${id}/characters`);
    if (!res.ok) {
      setCharacters([]);
      return;
    }
    const data = (await res.json()) as { characters: ProjectCharacterDto[] };
    setCharacters(data.characters ?? []);
  }, [id]);

  const loadCastMembers = useCallback(async () => {
    const res = await fetch("/api/cast-members");
    if (!res.ok) {
      setCastMembers([]);
      return;
    }
    const data = (await res.json()) as { members: CastMemberDto[] };
    setCastMembers(data.members ?? []);
  }, []);

  const loadEpisodes = useCallback(async () => {
    if (!id) return;
    setEpisodesLoading(true);
    setEpisodesError(null);
    setExportSrtsError(null);
    try {
      const res = await fetch(`/api/dubbing-projects/${id}/episodes`);
      if (!res.ok) {
        setEpisodes([]);
        setEpisodesError("Não foi possível carregar os episódios.");
        return;
      }
      const data = (await res.json()) as { episodes: DubbingEpisodeDto[] };
      setEpisodes(data.episodes ?? []);
    } catch {
      setEpisodes([]);
      setEpisodesError("Não foi possível carregar os episódios.");
    } finally {
      setEpisodesLoading(false);
    }
  }, [id]);

  const loadSessions = useCallback(async () => {
    if (!id) return;
    setSessionsLoading(true);
    setSessionsError(null);
    try {
      const res = await fetch(`/api/dubbing-projects/${id}/sessions`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setSessions([]);
        setSessionsError(
          "Não foi possível carregar a lista de sessões. Atualize a página ou tente de novo.",
        );
        return;
      }
      const data = (await res.json()) as { sessions: RecordingSessionDto[] };
      setSessions(data.sessions ?? []);
      setSessionVisibleCount(AGENDA_PAGE_SIZE);
    } catch {
      setSessions([]);
      setSessionsError(
        "Falha de rede ao carregar sessões. Verifique a conexão e tente de novo.",
      );
    } finally {
      setSessionsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (activeTab === "elenco") {
      void loadCharacters();
      void loadCastMembers();
    }
  }, [activeTab, loadCharacters, loadCastMembers]);

  useEffect(() => {
    if (activeTab === "episodios") {
      void loadEpisodes();
    }
  }, [activeTab, loadEpisodes]);

  useEffect(() => {
    if (activeTab === "agenda") {
      void loadSessions();
      void loadEpisodes();
      void loadCharacters();
      void loadCastMembers();
    }
  }, [activeTab, loadSessions, loadEpisodes, loadCharacters, loadCastMembers]);

  useEffect(() => {
    if (activeTab === "comunicacao") {
      void loadSessions();
      void loadCastMembers();
    }
  }, [activeTab, loadSessions, loadCastMembers]);

  useEffect(() => {
    if (!sessionSuggestionAppliedHint) return;
    const t = window.setTimeout(
      () => setSessionSuggestionAppliedHint(null),
      2800,
    );
    return () => window.clearTimeout(t);
  }, [sessionSuggestionAppliedHint]);

  useEffect(() => {
    return () => {
      const polls = transcriptionPollRef.current;
      for (const iv of Object.values(polls)) {
        clearInterval(iv);
      }
      transcriptionPollRef.current = {};
    };
  }, []);

  useEffect(() => {
    if (!episodeDropdownOpen) return;
    const onDocMouseDown = (e: MouseEvent) => {
      if (!episodeDropdownRef.current?.contains(e.target as Node)) {
        setEpisodeDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [episodeDropdownOpen]);

  const patchEpisodeRow = useCallback(
    async (epId: string, body: Record<string, unknown>) => {
      if (!id) return null;
      const res = await fetch(
        `/api/dubbing-projects/${id}/episodes/${encodeURIComponent(epId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { episode: DubbingEpisodeDto };
      return data.episode ?? null;
    },
    [id],
  );

  const stopTranscriptionPoll = useCallback((epId: string) => {
    const iv = transcriptionPollRef.current[epId];
    if (iv) {
      clearInterval(iv);
      delete transcriptionPollRef.current[epId];
    }
  }, []);

  const startTranscriptionPoll = useCallback(
    (epId: string, jobId: string) => {
      stopTranscriptionPoll(epId);
      const tick = async () => {
        const res = await fetch(
          `/api/jobs/${encodeURIComponent(jobId)}/status`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          status: string;
          subtitleFileId?: string | null;
          errorMessage?: string | null;
        };
        const st = data.status;
        if (st === "DONE") {
          stopTranscriptionPoll(epId);
          const updated = await patchEpisodeRow(epId, {
            // "DONE" fica reservado ao fluxo editorial no editor de SRT.
            status: "PENDING",
            subtitleFileId: data.subtitleFileId ?? null,
          });
          if (updated) {
            setEpisodes((prev) =>
              prev.map((e) => (e.id === epId ? updated : e)),
            );
          }
          setEpisodeInlineError((prev) => {
            const n = { ...prev };
            delete n[epId];
            return n;
          });
        } else if (st === "FAILED") {
          stopTranscriptionPoll(epId);
          await patchEpisodeRow(epId, { status: "PENDING" });
          setEpisodes((prev) =>
            prev.map((e) => (e.id === epId ? { ...e, status: "PENDING" } : e)),
          );
          const msg = data.errorMessage?.trim() || "A transcrição falhou.";
          setEpisodeInlineError((prev) => ({ ...prev, [epId]: msg }));
        }
      };
      transcriptionPollRef.current[epId] = setInterval(() => void tick(), 3000);
      void tick();
    },
    [patchEpisodeRow, stopTranscriptionPoll],
  );

  const onPickEpisodeAudio = (epId: string) => {
    audioTargetEpRef.current = epId;
    audioFileInputRef.current?.click();
  };

  const onEpisodeAudioSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const epId = audioTargetEpRef.current;
    const input = e.target;
    audioTargetEpRef.current = null;
    const file = input.files?.[0];
    input.value = "";
    if (!epId || !id || !file) return;

    setUploadingEpisodeId(epId);
    setEpisodeInlineError((prev) => {
      const n = { ...prev };
      delete n[epId];
      return n;
    });
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(
        `/api/dubbing-projects/${id}/episodes/${encodeURIComponent(epId)}/audio`,
        {
          method: "POST",
          body: fd,
        },
      );
      const raw = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err =
          typeof raw === "object" && raw && "error" in raw
            ? String((raw as { error?: unknown }).error)
            : "Falha no upload.";
        setEpisodeInlineError((prev) => ({ ...prev, [epId]: err }));
        return;
      }
      const data = raw as { episode?: DubbingEpisodeDto };
      if (data.episode) {
        setEpisodes((prev) =>
          prev.map((row) => (row.id === epId ? data.episode! : row)),
        );
      } else {
        void loadEpisodes();
      }
    } catch {
      setEpisodeInlineError((prev) => ({
        ...prev,
        [epId]: "Falha de rede no upload.",
      }));
    } finally {
      setUploadingEpisodeId(null);
    }
  };

  const onExportDoneEpisodesSrts = async () => {
    if (!id) return;
    setExportSrtsBusy(true);
    setExportSrtsError(null);
    try {
      const res = await fetch(
        `/api/dubbing-projects/${encodeURIComponent(id)}/episodes/export`,
        { cache: "no-store" },
      );
      if (res.status === 404) {
        setExportSrtsError("Nenhum episódio concluído");
        return;
      }
      if (!res.ok) {
        setExportSrtsError("Falha ao gerar o arquivo.");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition");
      let filename = `projeto-${id}-srts.zip`;
      if (cd) {
        const m = /filename="([^"]+)"/.exec(cd);
        if (m?.[1]) filename = m[1];
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportSrtsError("Falha de rede ao exportar.");
    } finally {
      setExportSrtsBusy(false);
    }
  };

  const onGenerateEpisodeSrt = async (ep: DubbingEpisodeDto) => {
    if (!id || !ep.audioFileId) return;
    setEpisodeInlineError((prev) => {
      const n = { ...prev };
      delete n[ep.id];
      return n;
    });
    try {
      const res = await fetch(
        `/api/dubbing-projects/${id}/episodes/${encodeURIComponent(ep.id)}/transcriptions`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({}),
        },
      );
      const raw = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err =
          typeof raw === "object" && raw && "error" in raw
            ? String((raw as { error?: unknown }).error)
            : "Não foi possível iniciar a transcrição.";
        setEpisodeInlineError((prev) => ({ ...prev, [ep.id]: err }));
        return;
      }
      const data = raw as {
        jobId?: string;
        episode?: DubbingEpisodeDto;
      };
      if (data.episode) {
        setEpisodes((prev) =>
          prev.map((row) => (row.id === ep.id ? data.episode! : row)),
        );
      }
      if (data.jobId) {
        startTranscriptionPoll(ep.id, data.jobId);
      }
    } catch {
      setEpisodeInlineError((prev) => ({
        ...prev,
        [ep.id]: "Falha de rede ao iniciar transcrição.",
      }));
    }
  };

  const onMarkEpisodeDone = async (ep: DubbingEpisodeDto) => {
    if (!id || ep.status === "DONE" || !ep.subtitleFileId) return;
    setEpisodeInlineError((prev) => ({
      ...prev,
      [ep.id]: "Conclua no editor de SRT (botão “Salvar e concluir”).",
    }));
  };

  const resetSessionForm = useCallback(() => {
    setEditingSessionId(null);
    setSessionForm(EMPTY_SESSION_FORM);
    setSessionTitleTouched(false);
    setSessionSuggestionAppliedHint(null);
  }, []);

  const onEditSession = useCallback((session: RecordingSessionDto) => {
    const startParts = partsFromIso(session.startAt);
    const endParts = partsFromIso(session.endAt);
    setEditingSessionId(session.id);
    setSessionForm({
      title: session.title,
      castMemberId: session.castMemberId,
      startDate: startParts.dateYmd,
      startHour24: startParts.hour24,
      startMinute: startParts.minute,
      endDate: endParts.dateYmd,
      endHour24: endParts.hour24,
      endMinute: endParts.minute,
      status: session.status,
      format: session.format,
      notes: session.notes ?? "",
      episodeIds:
        session.episodes && session.episodes.length > 0
          ? session.episodes.map((e) => e.id)
          : session.episodeId
            ? [session.episodeId]
            : [],
      characterId: session.characterId ?? "",
    });
    setSessionFeedback(null);
    setSessionsError(null);
    setSessionTitleTouched(true);
  }, []);

  const openCommunicationFromSession = useCallback(
    (session: RecordingSessionDto) => {
      const member =
        castMembers.find((c) => c.id === session.castMemberId) ?? null;
      const prefill = buildCommunicationFormPrefillFromSession(session, {
        projectName: project?.name?.trim() ? project.name : "Projeto",
        castMember: member,
        templateType: "SESSION_REMINDER",
      });
      setCommunicationTabDraft({ seed: Date.now(), prefill });
      setActiveTab("comunicacao");
    },
    [castMembers, project?.name],
  );

  const handleCommunicationDraftConsumed = useCallback(() => {
    setCommunicationTabDraft(null);
  }, []);

  useEffect(() => {
    if (editingSessionId) return;
    if (sessionTitleTouched) return;
    const pickedCharacter = characters.find(
      (c) => c.id === sessionForm.characterId,
    );
    if (pickedCharacter?.name?.trim()) {
      const suggested = `Gravação — ${pickedCharacter.name.trim()}`;
      if (sessionForm.title !== suggested) {
        setSessionForm((prev) => ({ ...prev, title: suggested }));
      }
      return;
    }
    const firstEpisodeId = sessionForm.episodeIds[0];
    const pickedEpisode = episodes.find((ep) => ep.id === firstEpisodeId);
    if (pickedEpisode) {
      const episodeTitle = pickedEpisode.title?.trim()
        ? `EP ${pickedEpisode.number} — ${pickedEpisode.title.trim()}`
        : `EP ${pickedEpisode.number}`;
      const suggested = `Gravação — ${episodeTitle}`;
      if (sessionForm.title !== suggested) {
        setSessionForm((prev) => ({ ...prev, title: suggested }));
      }
      return;
    }
    if (sessionForm.title !== "") {
      setSessionForm((prev) => ({ ...prev, title: "" }));
    }
  }, [
    characters,
    editingSessionId,
    episodes,
    sessionForm.characterId,
    sessionForm.episodeIds,
    sessionForm.title,
    sessionTitleTouched,
  ]);

  const onSaveSession = useCallback(async () => {
    if (!id) return;
    setSessionFeedback(null);
    setSessionSuggestionAppliedHint(null);
    setSessionsError(null);
    if (!sessionForm.title.trim()) {
      setSessionFeedbackTone("error");
      setSessionFeedback("Informe o título da sessão.");
      return;
    }
    if (!sessionForm.castMemberId) {
      setSessionFeedbackTone("error");
      setSessionFeedback("Selecione o dublador.");
      return;
    }
    const startIso = composeDateAndTimeToIso(
      sessionForm.startDate,
      sessionForm.startHour24,
      sessionForm.startMinute,
    );
    const endIso = composeDateAndTimeToIso(
      sessionForm.endDate,
      sessionForm.endHour24,
      sessionForm.endMinute,
    );
    if (!startIso || !endIso) {
      setSessionFeedbackTone("error");
      setSessionFeedback("Informe início e fim válidos.");
      return;
    }

    const proposedConflict = buildConflictSummaryForProposedSession({
      startAt: startIso,
      endAt: endIso,
      castMemberId: sessionForm.castMemberId,
      excludeSessionId: editingSessionId,
      sessions,
      availByMember: castMemberAvailabilities,
    });

    if (proposedConflict.severity === "hard") {
      const ok = await confirm({
        title: "Período bloqueado",
        description:
          "Este horário está em um período bloqueado do dublador. Deseja realmente salvar?",
        confirmLabel: "Continuar",
        cancelLabel: "Cancelar",
        variant: "danger",
      });
      if (!ok) return;
    } else if (proposedConflict.severity === "medium") {
      const ok = await confirm({
        title: "Período indisponível",
        description:
          "Este horário está em um período indisponível do dublador. Deseja continuar?",
        confirmLabel: "Continuar",
        cancelLabel: "Cancelar",
      });
      if (!ok) return;
    } else if (proposedConflict.severity === "soft") {
      const ok = await confirm({
        title: "Sobreposição na agenda",
        description:
          "Este horário coincide com outra sessão deste dublador. Deseja continuar?",
        confirmLabel: "Continuar",
        cancelLabel: "Cancelar",
      });
      if (!ok) return;
    }

    const basePayload = {
      title: sessionForm.title.trim(),
      castMemberId: sessionForm.castMemberId,
      startAt: startIso,
      endAt: endIso,
      status: sessionForm.status,
      format: sessionForm.format,
      notes: sessionForm.notes.trim() ? sessionForm.notes.trim() : null,
      characterId: sessionForm.characterId || null,
    };
    setSessionSaving(true);
    try {
      const isEdit = Boolean(editingSessionId);
      const url = isEdit
        ? `/api/dubbing-projects/${id}/sessions/${encodeURIComponent(editingSessionId!)}`
        : `/api/dubbing-projects/${id}/sessions`;
      const method = isEdit ? "PATCH" : "POST";
      const payload = {
        ...basePayload,
        episodeIds: sessionForm.episodeIds,
      };
      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const raw = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof raw === "object" && raw && "error" in raw
            ? String((raw as { error?: unknown }).error)
            : "Não foi possível salvar a sessão. Verifique os dados e tente de novo.";
        setSessionFeedbackTone("error");
        setSessionFeedback(msg);
        return;
      }

      let feedbackMsg = isEdit
        ? "Sessão atualizada com sucesso."
        : "Sessão criada com sucesso.";
      setSessionFeedbackTone("success");
      setSessionFeedback(feedbackMsg);
      resetSessionForm();
      await loadSessions();
    } catch {
      setSessionFeedbackTone("error");
      setSessionFeedback(
        "Falha de rede ao salvar a sessão. Tente de novo em instantes.",
      );
    } finally {
      setSessionSaving(false);
    }
  }, [
    castMemberAvailabilities,
    confirm,
    editingSessionId,
    id,
    loadSessions,
    resetSessionForm,
    sessionForm,
    sessions,
  ]);

  const onDeleteSession = useCallback(
    async (session: RecordingSessionDto) => {
      if (!id) return;
      const ok = await confirm({
        title: "Remover sessão",
        description: `Confirma remover a sessão "${session.title}"?`,
        variant: "danger",
        confirmLabel: "Remover",
        cancelLabel: "Cancelar",
      });
      if (!ok) return;
      setSessionDeletingId(session.id);
      setSessionFeedback(null);
      setSessionsError(null);
      try {
        const res = await fetch(
          `/api/dubbing-projects/${id}/sessions/${encodeURIComponent(session.id)}`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          const raw = await res.json().catch(() => ({}));
          const msg =
            typeof raw === "object" && raw && "error" in raw
              ? String((raw as { error?: unknown }).error)
              : "Não foi possível remover a sessão. Tente de novo.";
          setSessionFeedbackTone("error");
          setSessionFeedback(msg);
          return;
        }
        if (editingSessionId === session.id) resetSessionForm();
        setSessionFeedbackTone("success");
        setSessionFeedback("Sessão removida com sucesso.");
        await loadSessions();
      } catch {
        setSessionFeedbackTone("error");
        setSessionFeedback(
          "Falha de rede ao remover a sessão. Verifique a conexão.",
        );
      } finally {
        setSessionDeletingId(null);
      }
    },
    [confirm, editingSessionId, id, loadSessions, resetSessionForm],
  );

  const openNewChar = () => {
    setEditingChar(null);
    setCharModalOpen(true);
  };
  const openEditChar = (c: ProjectCharacterDto) => {
    setEditingChar(c);
    setCharModalOpen(true);
  };
  const onCharSaved = () => {
    setCharModalOpen(false);
    setEditingChar(null);
    void loadCharacters();
  };
  const onAssignmentChanged = () => {
    void loadCharacters();
  };

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<DubbingProjectEditFormInput, unknown, DubbingProjectEditFormData>(
    {
      resolver: zodResolver(dubbingProjectEditFormSchema) as Resolver<
        DubbingProjectEditFormInput,
        unknown,
        DubbingProjectEditFormData
      >,
      mode: "onBlur",
      reValidateMode: "onChange",
    },
  );

  useEffect(() => {
    if (project) {
      reset(getEditDefaults(project));
      clearErrors();
    }
  }, [project, reset, clearErrors]);

  const paymentType = watch("paymentType") ?? "PER_PROJECT";
  const watchedValue = watch("value");
  const watchedCurrency = watch("valueCurrency");
  const watchedEp = watch("episodes");
  const watchedMin = watch("durationMin");
  const watchedNotes = watch("notes");
  const watchedDeadline = watch("deadline");
  const watchedStatus = watch("status");
  const notesLen = watchedNotes?.length ?? 0;

  const episodeTotal = episodes.length;
  const episodeDoneCount = episodes.filter((e) => e.status === "DONE").length;
  const hasAnyDoneEpisode = episodeDoneCount > 0;
  const episodeTranscribingCount = episodes.filter(
    (e) => e.status === "TRANSCRIBING",
  ).length;
  const episodeProgressPct =
    episodeTotal > 0
      ? Math.round(
          ((episodeDoneCount + episodeTranscribingCount * 0.5) / episodeTotal) *
            100,
        )
      : 0;

  const numVal =
    typeof watchedValue === "number"
      ? watchedValue
      : parseFloat(String(watchedValue ?? "").replace(",", ".")) || 0;
  const numEp =
    typeof watchedEp === "number"
      ? watchedEp
      : parseInt(String(watchedEp ?? ""), 10) || 0;
  const numMin =
    typeof watchedMin === "number"
      ? watchedMin
      : parseInt(String(watchedMin ?? ""), 10) || 0;

  const totalContractHint = contractTotalHint(
    numVal,
    paymentType,
    numEp,
    numMin,
    watchedCurrency ?? "BRL",
  );

  const currentStatus = (watchedStatus ??
    project?.status ??
    "SPOTTING") as DubbingProjectStatus;

  const statusSubtitle =
    STATUS_LABELS.find((s) => s.value === currentStatus)?.label ??
    String(currentStatus);

  const filteredSortedSessions = useMemo(() => {
    const now = new Date();
    const filtered = sessions.filter((session) => {
      if (
        sessionStatusFilter !== "ALL" &&
        session.status !== sessionStatusFilter
      )
        return false;
      if (
        sessionCastFilter !== "ALL" &&
        session.castMemberId !== sessionCastFilter
      )
        return false;
      if (!isSessionInPeriod(session.startAt, sessionPeriodFilter, now))
        return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      const aStart = new Date(a.startAt).getTime();
      const bStart = new Date(b.startAt).getTime();
      if (aStart !== bStart) return aStart - bStart;
      const aCreated = new Date(a.createdAt).getTime();
      const bCreated = new Date(b.createdAt).getTime();
      return aCreated - bCreated;
    });
  }, [
    sessionCastFilter,
    sessionPeriodFilter,
    sessionStatusFilter,
    sessions,
  ]);

  const groupedSessions = useMemo(() => {
    const now = new Date();
    const visible = filteredSortedSessions.slice(0, sessionVisibleCount);
    const groups = buildSessionDayGroups(visible, now);
    return {
      total: sessions.length,
      filteredCount: filteredSortedSessions.length,
      visibleCount: visible.length,
      hasMore: visible.length < filteredSortedSessions.length,
      groups,
    };
  }, [filteredSortedSessions, sessionVisibleCount, sessions.length]);

  const agendaVisualDayGroups = useMemo(() => {
    const now = new Date();
    return buildSessionDayGroups(filteredSortedSessions, now);
  }, [filteredSortedSessions]);

  const sessionOverlapConflictIds = useMemo(
    () => computeSessionOverlapConflicts(filteredSortedSessions),
    [filteredSortedSessions],
  );

  const agendaCastMemberIds = useMemo(
    () =>
      [
        ...new Set(filteredSortedSessions.map((s) => s.castMemberId)),
      ].filter((x): x is string => Boolean(x)),
    [filteredSortedSessions],
  );

  const agendaAvailabilityMemberIds = useMemo(() => {
    const ids = new Set<string>(agendaCastMemberIds);
    if (activeTab === "agenda" && sessionForm.castMemberId.trim()) {
      ids.add(sessionForm.castMemberId);
    }
    return [...ids];
  }, [activeTab, agendaCastMemberIds, sessionForm.castMemberId]);

  useEffect(() => {
    if (activeTab !== "agenda") {
      agendaAvailabilityFetchedRef.current.clear();
      setCastMemberAvailabilities({});
      return;
    }
    for (const mid of agendaAvailabilityMemberIds) {
      if (agendaAvailabilityFetchedRef.current.has(mid)) continue;
      agendaAvailabilityFetchedRef.current.add(mid);
      void fetch(
        `/api/cast-members/${encodeURIComponent(mid)}/availability`,
        { cache: "no-store" },
      )
        .then(async (res) => {
          if (!res.ok) {
            agendaAvailabilityFetchedRef.current.delete(mid);
            return;
          }
          const data = (await res.json()) as {
            availabilities: CastMemberAvailabilityDto[];
          };
          setCastMemberAvailabilities((prev) => ({
            ...prev,
            [mid]: data.availabilities ?? [],
          }));
        })
        .catch(() => {
          agendaAvailabilityFetchedRef.current.delete(mid);
        });
    }
  }, [activeTab, agendaAvailabilityMemberIds]);

  const sessionSuggestionAnchorYmd = useMemo(() => {
    if (
      sessionForm.startDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(sessionForm.startDate)
    ) {
      return sessionForm.startDate;
    }
    return getLocalDayKey(new Date());
  }, [sessionForm.startDate]);

  const sessionFormDurationMs = useMemo(() => {
    const startIso = composeDateAndTimeToIso(
      sessionForm.startDate,
      sessionForm.startHour24,
      sessionForm.startMinute,
    );
    const endIso = composeDateAndTimeToIso(
      sessionForm.endDate,
      sessionForm.endHour24,
      sessionForm.endMinute,
    );
    if (!startIso || !endIso) return 60 * 60 * 1000;
    const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
    if (ms >= 60 * 1000) return ms;
    return 60 * 60 * 1000;
  }, [
    sessionForm.startDate,
    sessionForm.startHour24,
    sessionForm.startMinute,
    sessionForm.endDate,
    sessionForm.endHour24,
    sessionForm.endMinute,
  ]);

  const sessionMinStartMsForSuggestions = useMemo(() => {
    const today = getLocalDayKey(new Date());
    if (sessionSuggestionAnchorYmd !== today) return undefined;
    return Date.now();
  }, [sessionSuggestionAnchorYmd]);

  const sessionTimeSuggestions = useMemo(() => {
    if (activeTab !== "agenda") return [];
    if (!sessionForm.castMemberId.trim()) return [];
    return computeSessionTimeSuggestions({
      anchorDateYmd: sessionSuggestionAnchorYmd,
      durationMs: sessionFormDurationMs,
      castMemberId: sessionForm.castMemberId,
      sessions,
      availabilities: castMemberAvailabilities[sessionForm.castMemberId],
      excludeSessionId: editingSessionId,
      minStartMs: sessionMinStartMsForSuggestions,
    });
  }, [
    activeTab,
    castMemberAvailabilities,
    editingSessionId,
    sessionForm.castMemberId,
    sessionFormDurationMs,
    sessionMinStartMsForSuggestions,
    sessionSuggestionAnchorYmd,
    sessions,
  ]);

  const sessionConflictSummaryById = useMemo(() => {
    const map = new Map<string, SessionConflictSummary>();
    for (const s of filteredSortedSessions) {
      map.set(
        s.id,
        buildSessionConflictSummary(
          s,
          sessionOverlapConflictIds.has(s.id),
          castMemberAvailabilities,
        ),
      );
    }
    return map;
  }, [
    filteredSortedSessions,
    sessionOverlapConflictIds,
    castMemberAvailabilities,
  ]);

  const agendaDayConflictStatsByDayKey = useMemo(() => {
    const m = new Map<string, AgendaDayConflictStats>();
    for (const s of filteredSortedSessions) {
      const summary = sessionConflictSummaryById.get(s.id);
      if (!summary?.hasConflict || !summary.severity) continue;
      const dt = new Date(s.startAt);
      if (Number.isNaN(dt.getTime())) continue;
      const dk = getLocalDayKey(dt);
      const cur = m.get(dk) ?? { total: 0, hard: 0, medium: 0 };
      cur.total += 1;
      if (summary.severity === "hard") cur.hard += 1;
      else if (summary.severity === "medium") cur.medium += 1;
      m.set(dk, cur);
    }
    return m;
  }, [filteredSortedSessions, sessionConflictSummaryById]);

  useEffect(() => {
    setSessionVisibleCount(AGENDA_PAGE_SIZE);
  }, [sessionStatusFilter, sessionCastFilter, sessionPeriodFilter]);

  const selectedEpisodeLabel = useMemo(() => {
    if (sessionForm.episodeIds.length === 0) return "Nenhum";
    if (sessionForm.episodeIds.length === 1) {
      const ep = episodes.find((item) => item.id === sessionForm.episodeIds[0]);
      if (!ep) return "1 episódio";
      return `EP ${ep.number}${ep.title?.trim() ? ` - ${ep.title.trim()}` : ""}`;
    }
    return `${sessionForm.episodeIds.length} episódios selecionados`;
  }, [episodes, sessionForm.episodeIds]);

  const onSubmit = async (data: DubbingProjectEditFormData) => {
    if (activeTab !== "info") return;
    clearErrors("root");
    const storedTotal = normalizeMoneyForStorage(
      formUnitToStoredTotal(
        data.value,
        data.paymentType,
        data.episodes,
        data.durationMin,
      ),
    );
    const body = {
      name: data.name,
      client: data.client,
      clientId: data.clientId ?? null,
      startDate: data.startDate,
      deadline: data.deadline,
      episodes: data.episodes,
      durationMin: data.durationMin,
      language: data.language,
      value: storedTotal,
      valueCurrency: data.valueCurrency,
      paymentType: data.paymentType,
      status: data.status,
      notes: data.notes?.trim() ? data.notes.trim() : null,
    };

    const res = await fetch(`/api/dubbing-projects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let msg = "Erro ao salvar. Tente novamente.";
      try {
        const j = (await res.json()) as { error?: string; details?: unknown };
        if (j.error) msg = j.error;
      } catch {
        /* ignore */
      }
      setError("root", { message: msg });
      return;
    }
    const updated = (await res.json()) as { project: DubbingProjectDto };
    setProject(updated.project);
    reset(getEditDefaults(updated.project));
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 3000);
  };

  const handleDelete = async () => {
    if (!project) return;
    const ok = await confirm({
      title: "Excluir projeto",
      description: `Confirma excluir "${project.name}"? Esta ação não pode ser desfeita.`,
      variant: "danger",
      confirmLabel: "Sim, excluir",
      cancelLabel: "Não",
    });
    if (!ok) return;
    const res = await fetch(`/api/dubbing-projects/${id}`, {
      method: "DELETE",
    });
    if (res.ok) router.push("/projetos");
  };

  if (loading) {
    return (
      <PageShell title="Carregando…" section="gestao">
        <div className="flex h-full min-h-[200px] items-center justify-center text-[13px] text-[#505050]">
          Carregando projeto…
        </div>
      </PageShell>
    );
  }

  if (notFound || !project) {
    return (
      <PageShell title="Projeto não encontrado" section="gestao">
        <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-4">
          <p className="text-[13px] text-[#505050]">
            Este projeto não existe ou foi removido.
          </p>
          <button
            type="button"
            onClick={() => router.push("/projetos")}
            className="rounded-[6px] border border-[#2e2e2e] bg-[#252525] px-[14px] py-[6px] text-[12px] text-[#909090] hover:bg-[#2a2a2a]"
          >
            ← Voltar aos projetos
          </button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={project.name}
      section="gestao"
      subtitle={`· ${statusSubtitle}`}
      noScroll
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center gap-[6px] border-b border-[#1e1e1e] bg-[#141414] px-[24px] py-[7px] text-[11px]">
          <button
            type="button"
            onClick={() => router.push("/projetos")}
            className="text-[#505050] transition-colors hover:text-[#909090]"
          >
            ← Projetos
          </button>
          <span className="text-[#2e2e2e]">/</span>
          <span className="max-w-[min(100%,300px)] truncate text-[#909090]">
            {project.name}
          </span>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex min-h-0 flex-1 flex-row"
        >
          {/* Sidebar */}
          <aside className="flex w-[200px] shrink-0 flex-col border-r border-[#1e1e1e] bg-[#141414] px-[8px] py-[12px]">
            <div className="mb-[4px] px-[8px] text-[9px] font-[700] uppercase tracking-[0.1em] text-[#333]">
              Este projeto
            </div>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                disabled={!tab.enabled}
                onClick={() => tab.enabled && setActiveTab(tab.id)}
                className={`mb-[1px] flex w-full items-center justify-between rounded-[6px] px-[10px] py-[7px] text-left text-[12px] transition-colors ${
                  activeTab === tab.id
                    ? "bg-[#0d3d2a] text-[#5DCAA5]"
                    : tab.enabled
                      ? "text-[#505050] hover:bg-[#1e1e1e] hover:text-[#909090]"
                      : "cursor-not-allowed text-[#505050] opacity-40"
                }`}
              >
                <span>{tab.label}</span>
                {!tab.enabled ? (
                  <span className="text-[9px] italic text-[#333]">
                    em breve
                  </span>
                ) : null}
              </button>
            ))}

            <div className="mt-auto">
              <div className="my-[8px] h-px bg-[#1e1e1e]" />
              <div className="mb-[4px] px-[8px] text-[9px] font-[700] uppercase tracking-[0.1em] text-[#333]"></div>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="flex w-full items-center gap-[8px] rounded-[6px] px-[10px] py-[7px] text-[12px] text-[#505050] transition-colors hover:bg-[#2a0a0a] hover:text-[#F09595] disabled:opacity-40"
              >
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6l-1 14H6L5 6" />
                  <path d="M10 11v6M14 11v6" />
                </svg>
                Excluir projeto
              </button>
            </div>
          </aside>

          {/* Conteúdo + footer */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-[20px] py-[20px] sm:px-[28px] sm:py-[24px]">
              <div className="flex w-full max-w-none flex-col">
                <div className="mb-[16px]">
                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <ProjectStatusStepper
                        currentStatus={
                          (field.value ??
                            project.status) as DubbingProjectStatus
                        }
                        deadline={
                          typeof watchedDeadline === "string"
                            ? watchedDeadline
                            : project.deadline
                        }
                        onChange={(s) =>
                          setValue("status", s, { shouldDirty: true })
                        }
                      />
                    )}
                  />
                </div>

                {activeTab === "info" && (
                  <div className="flex flex-col gap-[14px]">
                    <p className="text-[10px] text-[#444]">
                      Campos marcados com{" "}
                      <span className="text-[#E24B4A]">*</span> são obrigatórios
                    </p>

                    {errors.root ? (
                      <div className="mb-[12px] rounded-[5px] border border-[#5a1515] bg-[#2a0a0a] px-[10px] py-[8px] text-[11px] text-[#F09595]">
                        {errors.root.message}
                      </div>
                    ) : null}

                    <div className="project-edit-grid">
                      <div className="project-edit-col-main">
                        <div className="overflow-hidden rounded-[10px] border border-[#252525] bg-[#1a1a1a]">
                          <div className="flex items-center justify-between border-b border-[#252525] px-[14px] py-[10px]">
                            <span className="text-[12px] font-[600] text-[#e8e8e8]">
                              Identificação
                            </span>
                            <span className="font-mono text-[10px] text-[#404040]">
                              ID: {id.length > 12 ? `${id.slice(0, 8)}…` : id}
                            </span>
                          </div>
                          <div className="flex flex-col gap-[10px] p-[14px]">
                            <div>
                              <label
                                className={labelCls}
                                htmlFor="edit-project-name"
                              >
                                Nome do projeto{" "}
                                <span className="text-[#E24B4A]">*</span>
                              </label>
                              <input
                                id="edit-project-name"
                                {...register("name")}
                                className={errors.name ? inputErrCls : inputCls}
                                placeholder="Nome do projeto"
                              />
                              {errors.name ? (
                                <p className={errorCls}>
                                  {errors.name.message}
                                </p>
                              ) : null}
                            </div>
                            <div className="grid grid-cols-1 gap-[10px] sm:grid-cols-2">
                              <div>
                                <label
                                  className={labelCls}
                                  htmlFor="edit-project-client"
                                >
                                  Cliente / Contratante{" "}
                                  <span className="text-[#E24B4A]">*</span>
                                </label>
                                <Controller
                                  name="client"
                                  control={control}
                                  render={({ field }) => (
                                    <ClientSelect
                                      value={field.value ?? ""}
                                      clientId={
                                        (watch("clientId") as
                                          | string
                                          | null
                                          | undefined) ?? null
                                      }
                                      refreshToken={clientListRefresh}
                                      onChange={(text, cid) => {
                                        field.onChange(text);
                                        setValue("clientId", cid, {
                                          shouldDirty: true,
                                        });
                                      }}
                                      onCreateNew={() =>
                                        setClientModalOpen(true)
                                      }
                                      error={!!errors.client}
                                    />
                                  )}
                                />
                                {errors.client ? (
                                  <p className={errorCls}>
                                    {errors.client.message}
                                  </p>
                                ) : null}
                              </div>
                              <div>
                                <label className={labelCls}>
                                  Idioma original *
                                </label>
                                <Controller
                                  name="language"
                                  control={control}
                                  render={({ field }) => (
                                    <LanguageCombobox
                                      id="edit-project-language"
                                      value={field.value}
                                      onChange={field.onChange}
                                      className={inputCls}
                                    />
                                  )}
                                />
                                {errors.language ? (
                                  <p className={errorCls}>
                                    {errors.language.message}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="overflow-hidden rounded-[10px] border border-[#252525] bg-[#1a1a1a]">
                          <div className="border-b border-[#252525] px-[14px] py-[10px]">
                            <span className="text-[12px] font-[600] text-[#e8e8e8]">
                              Datas
                            </span>
                          </div>
                          <div className="grid grid-cols-1 gap-[10px] p-[14px] sm:grid-cols-2">
                            <div>
                              <label className={labelCls} htmlFor="edit-start">
                                Início <span className="text-[#E24B4A]">*</span>
                              </label>
                              <Controller
                                name="startDate"
                                control={control}
                                render={({ field }) => (
                                  <DateInput
                                    id="edit-start"
                                    value={
                                      field.value === null ||
                                      field.value === undefined
                                        ? ""
                                        : String(field.value)
                                    }
                                    onChange={field.onChange}
                                    placeholder="dd/mm/aaaa"
                                    className={
                                      errors.startDate ? inputErrCls : inputCls
                                    }
                                  />
                                )}
                              />
                              {errors.startDate ? (
                                <p className={errorCls}>
                                  {errors.startDate.message}
                                </p>
                              ) : null}
                            </div>
                            <div>
                              <label
                                className={labelCls}
                                htmlFor="edit-deadline"
                              >
                                Prazo de entrega{" "}
                                <span className="text-[#E24B4A]">*</span>
                              </label>
                              <Controller
                                name="deadline"
                                control={control}
                                render={({ field }) => (
                                  <DateInput
                                    id="edit-deadline"
                                    value={
                                      field.value === null ||
                                      field.value === undefined
                                        ? ""
                                        : String(field.value)
                                    }
                                    onChange={field.onChange}
                                    placeholder="dd/mm/aaaa"
                                    className={
                                      errors.deadline ? inputErrCls : inputCls
                                    }
                                  />
                                )}
                              />
                              {errors.deadline ? (
                                <p className={errorCls}>
                                  {errors.deadline.message}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="overflow-hidden rounded-[10px] border border-[#252525] bg-[#1a1a1a]">
                          <div className="border-b border-[#252525] px-[14px] py-[10px]">
                            <span className="text-[12px] font-[600] text-[#e8e8e8]">
                              Observações
                            </span>
                          </div>
                          <div className="p-[14px]">
                            <textarea
                              {...register("notes")}
                              rows={5}
                              maxLength={2000}
                              className={`${errors.notes ? inputErrCls : inputCls} min-h-[100px] resize-none`}
                              placeholder="Notas internas, instruções do cliente, referências..."
                            />
                            <div
                              className={`mt-[3px] text-right text-[10px] ${
                                notesLen > 1800
                                  ? "text-[#EF9F27]"
                                  : "text-[#444]"
                              }`}
                            >
                              {notesLen} / 2000
                            </div>
                            {errors.notes ? (
                              <p className={errorCls}>{errors.notes.message}</p>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="project-edit-col-side">
                        <div className="overflow-hidden rounded-[10px] border border-[#252525] bg-[#1a1a1a]">
                          <div className="border-b border-[#252525] px-[14px] py-[10px]">
                            <span className="text-[12px] font-[600] text-[#e8e8e8]">
                              Escopo
                            </span>
                          </div>
                          <div className="flex flex-col gap-[10px] p-[14px]">
                            <div>
                              <label
                                className={labelCls}
                                htmlFor="edit-episodes"
                              >
                                Nº de episódios{" "}
                                <span className="text-[#E24B4A]">*</span>
                              </label>
                              <input
                                id="edit-episodes"
                                type="number"
                                min={1}
                                {...register("episodes")}
                                className={
                                  errors.episodes ? inputErrCls : inputCls
                                }
                                placeholder="Ex: 24"
                              />
                              {errors.episodes ? (
                                <p className={errorCls}>
                                  {errors.episodes.message}
                                </p>
                              ) : null}
                            </div>
                            <div>
                              <label
                                className={labelCls}
                                htmlFor="edit-duration"
                              >
                                Minutagem total (min){" "}
                                <span className="text-[#E24B4A]">*</span>
                              </label>
                              <input
                                id="edit-duration"
                                type="number"
                                min={1}
                                {...register("durationMin")}
                                className={
                                  errors.durationMin ? inputErrCls : inputCls
                                }
                                placeholder="Ex: 528"
                              />
                              {errors.durationMin ? (
                                <p className={errorCls}>
                                  {errors.durationMin.message}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <div className="overflow-hidden rounded-[10px] border border-[#252525] bg-[#1a1a1a]">
                          <div className="border-b border-[#252525] px-[14px] py-[10px]">
                            <span className="text-[12px] font-[600] text-[#e8e8e8]">
                              Financeiro
                            </span>
                          </div>
                          <div className="flex flex-col gap-[10px] p-[14px]">
                            <div>
                              <label
                                className={labelCls}
                                htmlFor="edit-payment"
                              >
                                Forma de pagamento
                              </label>
                              <select
                                id="edit-payment"
                                {...register("paymentType")}
                                className={inputCls}
                              >
                                {PAYMENT_OPTIONS.map((o) => (
                                  <option key={o.value} value={o.value}>
                                    {o.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className={labelCls} htmlFor="edit-value">
                                {valueFieldLabel(paymentType)}{" "}
                                <span className="text-[#E24B4A]">*</span>
                              </label>
                              <Controller
                                name="value"
                                control={control}
                                render={({ field: valField }) => (
                                  <Controller
                                    name="valueCurrency"
                                    control={control}
                                    render={({ field: curField }) => (
                                      <CurrencyValueField
                                        id="edit-value"
                                        value={
                                          typeof valField.value === "number"
                                            ? valField.value
                                            : 0
                                        }
                                        onChange={valField.onChange}
                                        currency={curField.value ?? "BRL"}
                                        onCurrencyChange={curField.onChange}
                                        error={!!errors.value}
                                        inputCls={inputCls}
                                        inputErrCls={inputErrCls}
                                      />
                                    )}
                                  />
                                )}
                              />
                              {totalContractHint ? (
                                <p className="mt-[4px] text-[11px] text-[#5DCAA5]">
                                  {totalContractHint}
                                </p>
                              ) : null}
                              {errors.value ? (
                                <p className={errorCls}>
                                  {errors.value.message}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {activeTab === "elenco" && (
                  <div className="flex-1 overflow-y-auto px-[24px] py-[20px]">
                    <div className="mx-auto" style={{ maxWidth: 900 }}>
                      <div className="mb-[16px] flex items-center justify-between">
                        <div>
                          <h2 className="text-[14px] font-[600] text-[#e8e8e8]">
                            Elenco do projeto
                          </h2>
                          <p className="mt-[2px] text-[11px] text-[#505050]">
                            {characters.length} personagem
                            {characters.length !== 1 ? "s" : ""}
                            {" · "}
                            {
                              characters.filter((c) => c.castMemberId).length
                            }{" "}
                            dublador
                            {characters.filter((c) => c.castMemberId).length !==
                            1
                              ? "es"
                              : ""}{" "}
                            escalado
                            {characters.filter((c) => c.castMemberId).length !==
                            1
                              ? "s"
                              : ""}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={openNewChar}
                          className="flex items-center gap-[6px] rounded-[6px] border border-[#0F6E56] bg-[#1D9E75] px-[12px] py-[5px] text-[11px] font-[500] text-white transition-colors hover:bg-[#0F6E56]"
                        >
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 16 16"
                            fill="none"
                          >
                            <path
                              d="M8 2v12M2 8h12"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                          Adicionar personagem
                        </button>
                      </div>

                      {characters.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-[12px] rounded-[10px] border border-[#252525] bg-[#1a1a1a] py-[48px]">
                          <div className="flex h-[44px] w-[44px] items-center justify-center rounded-[10px] border border-[#2a2a2a] bg-[#141414]">
                            <svg
                              width="20"
                              height="20"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="#404040"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                              <circle cx="9" cy="7" r="4" />
                            </svg>
                          </div>
                          <div className="text-center">
                            <p className="text-[13px] font-[500] text-[#505050]">
                              Nenhum personagem adicionado
                            </p>
                            <p className="mt-[2px] text-[11px] text-[#404040]">
                              Adicione os personagens e escale dubladores
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={openNewChar}
                            className="flex items-center gap-[6px] rounded-[6px] border border-[#0F6E56] bg-[#1D9E75] px-[12px] py-[5px] text-[11px] font-[500] text-white transition-colors hover:bg-[#0F6E56]"
                          >
                            + Adicionar personagem
                          </button>
                        </div>
                      ) : (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fill, minmax(280px, 1fr))",
                            gap: 10,
                          }}
                        >
                          {characters.map((c) => (
                            <CharacterCard
                              key={c.id}
                              character={c}
                              castMembers={castMembers}
                              projectId={id}
                              onEdit={openEditChar}
                              onAssignmentChanged={onAssignmentChanged}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {activeTab === "episodios" && (
                  <div className="flex-1 overflow-y-auto px-[24px] py-[20px]">
                    {/* estilos locais da lista */}
                    <style>{`
                      .ep-item { transition: background 0.12s; }
                      .ep-item:hover { background: #1a1a1a; }
                      .badge-done        { background:#0d3d2a; border:1px solid #0F6E56; color:#5DCAA5; }
                      .badge-no-audio    { background:#2a2a2a; border:1px solid #404040; color:#909090; }
                      .badge-audio       { background:#2a3140; border:1px solid #3d4450; color:#A8B4CC; }
                      .badge-transcribing{ background:#3d3520; border:1px solid #5c4a20; color:#EF9F27; }
                      .badge-ready       { background:#152a3d; border:1px solid #1a4d6e; color:#7EC8E3; }
                      .badge-editing     { background:#0d3d2a; border:1px solid #0F6E56; color:#5DCAA5; }
                      .ep-spin { display:inline-block; width:10px; height:10px; border:2px solid #EF9F27;
                                 border-top-color:transparent; border-radius:50%;
                                 animation:ep-spin-anim 0.7s linear infinite; }
                      @keyframes ep-spin-anim { to { transform: rotate(360deg); } }
                      .meta-chip-has { color:#5DCAA5 !important; border-color:#0F6E5644 !important; background:#0d3d2a55 !important; }
                      .act-btn-primary { border-color:#0F6E56 !important; background:#0d3d2a88 !important; color:#5DCAA5 !important; }
                      .act-btn-primary:hover:not(:disabled) { background:#0d3d2acc !important; }
                    `}</style>

                    <div className="mx-auto" style={{ maxWidth: 900 }}>
                      {/* cabeçalho da seção */}
                      <div className="mb-[16px] flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="text-[14px] font-[600] text-[#e8e8e8]">
                            Episódios
                          </h2>
                          <p className="mt-[2px] text-[11px] text-[#505050]">
                            Lista editorial por número
                          </p>
                        </div>
                        {hasAnyDoneEpisode ? (
                          <button
                            type="button"
                            disabled={exportSrtsBusy || episodesLoading}
                            onClick={() => void onExportDoneEpisodesSrts()}
                            className="shrink-0 rounded-[6px] border border-[#0F6E56] bg-[#1D9E75] px-[12px] py-[6px] text-[11px] font-[500] text-white transition-colors hover:bg-[#0F6E56] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {exportSrtsBusy ? "Gerando…" : "↓ Baixar SRTs"}
                          </button>
                        ) : null}
                      </div>

                      {exportSrtsError ? (
                        <p className="mb-[12px] text-[11px] text-[#F09595]">
                          {exportSrtsError}
                        </p>
                      ) : null}

                      {episodesLoading ? (
                        <div className="flex min-h-[160px] items-center justify-center rounded-[10px] border border-[#252525] bg-[#1a1a1a] text-[13px] text-[#505050]">
                          Carregando episódios…
                        </div>
                      ) : episodesError ? (
                        <div className="rounded-[10px] border border-[#5a1515] bg-[#2a0a0a] px-[14px] py-[12px] text-[12px] text-[#F09595]">
                          {episodesError}
                        </div>
                      ) : (
                        <>
                          <input
                            ref={audioFileInputRef}
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            aria-hidden
                            onChange={onEpisodeAudioSelected}
                          />

                          {/* barra de progresso */}
                          <div className="mb-[12px] overflow-hidden rounded-[10px] border border-[#252525] bg-[#1a1a1a]">
                            <div className="border-b border-[#252525] px-[14px] py-[10px]">
                              <span className="text-[12px] font-[600] text-[#e8e8e8]">
                                Progresso
                              </span>
                            </div>
                            <div className="p-[14px]">
                              <p className="mb-[8px] text-[12px] text-[#909090]">
                                {episodeDoneCount} de {episodeTotal} episódios
                                concluídos
                              </p>
                              <div className="h-[6px] w-full overflow-hidden rounded-full bg-[#252525]">
                                <div
                                  className="h-full rounded-full bg-[#1D9E75] transition-[width] duration-300"
                                  style={{ width: `${episodeProgressPct}%` }}
                                  aria-hidden
                                />
                              </div>
                            </div>
                          </div>

                          {episodes.length === 0 ? (
                            <div className="flex flex-col items-center justify-center gap-[12px] rounded-[10px] border border-[#252525] bg-[#1a1a1a] py-[48px]">
                              <p className="text-[13px] font-[500] text-[#505050]">
                                Nenhum episódio neste projeto
                              </p>
                              <p className="text-[11px] text-[#404040]">
                                Os episódios são criados ao definir o projeto
                              </p>
                            </div>
                          ) : (
                            <div className="overflow-visible rounded-[10px] border border-[#252525] bg-[#141414]">
                              <div className="border-b border-[#252525] px-[14px] py-[10px]">
                                <span className="text-[12px] font-[600] text-[#e8e8e8]">
                                  Lista ({episodes.length})
                                </span>
                              </div>

                              <ul className="divide-y divide-[#252525]">
                                {episodes.map((ep) => {
                                  const title =
                                    ep.title?.trim() || `Episódio ${ep.number}`;
                                  const badge = getWorkflowBadge(ep);
                                  const busy =
                                    ep.status === "TRANSCRIBING" ||
                                    uploadingEpisodeId === ep.id;
                                  const inlineErr = episodeInlineError[ep.id];
                                  const editedStr = formatEpisodeTimestamp(
                                    ep.editedAt,
                                  );
                                  const updatedStr = formatEpisodeTimestamp(
                                    ep.updatedAt,
                                  );

                                  // ações possíveis
                                  const canSendAudio = !busy;
                                  const canStartTx =
                                    Boolean(ep.audioFileId) &&
                                    !busy &&
                                    !ep.subtitleFileId;
                                  const canOpenEditor = Boolean(
                                    ep.subtitleFileId,
                                  );
                                  const canMarkDone = false;

                                  // qual é a ação principal do momento?
                                  const primaryAction = !ep.audioFileId
                                    ? "audio"
                                    : !ep.subtitleFileId
                                      ? "transcribe"
                                      : ep.status !== "DONE"
                                        ? "editor"
                                        : null;

                                  const baseBtnCls =
                                    "rounded-[5px] border border-[#2e2e2e] bg-[#141414] px-[8px] py-[4px] text-[10px] font-[500] text-[#cfcfcf] transition-colors hover:bg-[#252525] hover:text-[#e8e8e8] disabled:cursor-not-allowed disabled:opacity-35";

                                  return (
                                    <li
                                      key={ep.id}
                                      className="ep-item flex flex-col gap-[10px] px-[14px] py-[12px]"
                                    >
                                      {/* linha principal: número · conteúdo */}
                                      <div className="flex min-w-0 items-start gap-[10px]">
                                        {/* número */}
                                        <span className="w-[22px] shrink-0 pt-[2px] font-mono text-[11px] text-[#505050]">
                                          #{ep.number}
                                        </span>

                                        {/* conteúdo */}
                                        <div className="min-w-0 flex-1">
                                          {/* badge + título */}
                                          <div className="mb-[6px] flex flex-wrap items-center gap-x-[8px] gap-y-[4px]">
                                            {badge.spinning ? (
                                              <span className="inline-flex items-center gap-[5px] rounded-[4px] border border-[#5c4a20] bg-[#3d3520] px-[8px] py-[2px] text-[10px] font-[600] uppercase tracking-[0.05em] text-[#EF9F27]">
                                                <span
                                                  className="ep-spin"
                                                  aria-hidden
                                                />
                                                Em transcrição
                                              </span>
                                            ) : (
                                              <span
                                                className={`inline-flex items-center rounded-[4px] px-[8px] py-[2px] text-[10px] font-[600] uppercase tracking-[0.05em] ${badge.className}`}
                                              >
                                                {badge.label === "Concluído"
                                                  ? "✓ "
                                                  : ""}
                                                {badge.label}
                                              </span>
                                            )}
                                            <span
                                              className="min-w-0 truncate text-[13px] font-[500] text-[#e8e8e8]"
                                              title={title}
                                            >
                                              {title}
                                            </span>
                                          </div>

                                          {/* meta chips */}
                                          <div className="mb-[6px] flex flex-wrap gap-[5px]">
                                            {(
                                              [
                                                {
                                                  key: "audio",
                                                  has: Boolean(ep.audioFileId),
                                                  label: "Áudio",
                                                },
                                                {
                                                  key: "tx",
                                                  has: Boolean(
                                                    ep.transcriptionProjectId,
                                                  ),
                                                  label: "Transcrição",
                                                },
                                                {
                                                  key: "legenda",
                                                  has: Boolean(
                                                    ep.subtitleFileId,
                                                  ),
                                                  label: "Legenda",
                                                },
                                              ] as const
                                            ).map(({ key, has, label }) => (
                                              <span
                                                key={key}
                                                className={`rounded-[3px] border border-[#333] bg-[#1e1e1e] px-[6px] py-[1px] text-[10px] text-[#606060] ${has ? "meta-chip-has" : ""}`}
                                              >
                                                {has ? "✓ " : ""}
                                                {label}
                                              </span>
                                            ))}
                                          </div>

                                          {/* timestamp */}
                                          {editedStr || updatedStr ? (
                                            <p className="mb-[6px] text-[10px] text-[#505050]">
                                              {editedStr ? (
                                                <>Editado: {editedStr}</>
                                              ) : null}
                                              {editedStr && updatedStr
                                                ? " · "
                                                : null}
                                              {!editedStr && updatedStr ? (
                                                <>Atualizado: {updatedStr}</>
                                              ) : null}
                                            </p>
                                          ) : null}

                                          {/* erro inline */}
                                          {inlineErr ? (
                                            <p className="mb-[6px] text-[11px] text-[#F09595]">
                                              {inlineErr}
                                            </p>
                                          ) : null}
                                        </div>
                                      </div>

                                      {/* linha de ações */}
                                      <div className="flex flex-wrap gap-[6px] pl-[32px]">
                                        <button
                                          type="button"
                                          disabled={!canSendAudio}
                                          onClick={() =>
                                            onPickEpisodeAudio(ep.id)
                                          }
                                          className={`${baseBtnCls} ${primaryAction === "audio" ? "act-btn-primary" : ""}`}
                                        >
                                          {ep.audioFileId
                                            ? "Substituir áudio"
                                            : "Enviar áudio"}
                                        </button>

                                        <button
                                          type="button"
                                          disabled={!canStartTx}
                                          onClick={() =>
                                            void onGenerateEpisodeSrt(ep)
                                          }
                                          className={`${baseBtnCls} ${primaryAction === "transcribe" ? "act-btn-primary" : ""}`}
                                        >
                                          Iniciar transcrição
                                        </button>

                                        <span
                                          title={
                                            canOpenEditor
                                              ? "Abrir o editor de legendas deste episódio"
                                              : "Aguardando ficheiro de legenda"
                                          }
                                          className="inline-flex"
                                        >
                                          <button
                                            type="button"
                                            disabled={!canOpenEditor || !id}
                                            onClick={() => {
                                              if (!id || !canOpenEditor) return;
                                              router.push(
                                                `/subtitle-file-edit?projectId=${encodeURIComponent(id)}&episodeId=${encodeURIComponent(ep.id)}`,
                                              );
                                            }}
                                            className={`${baseBtnCls} ${primaryAction === "editor" ? "act-btn-primary" : ""}`}
                                          >
                                            {canOpenEditor
                                              ? "Abrir editor"
                                              : "Aguardando transcrição"}
                                          </button>
                                        </span>

                                        <button
                                          type="button"
                                          disabled={!canMarkDone}
                                          className={baseBtnCls}
                                          title="Concluir apenas no editor de SRT (Salvar e concluir)"
                                        >
                                          Concluir no editor
                                        </button>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>

                              {/* 3 pontinhos no fim */}
                              <div className="flex items-center justify-center gap-[6px] py-[14px]">
                                {[0, 1, 2].map((i) => (
                                  <span
                                    key={i}
                                    className="block h-[4px] w-[4px] rounded-full bg-[#2e2e2e]"
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
                {activeTab === "comunicacao" && id ? (
                  <div className="flex-1 overflow-y-auto px-[24px] py-[20px]">
                    <div className="mx-auto flex max-w-[980px] flex-col gap-[12px]">
                      <ProjectCommunicationTab
                        projectId={id}
                        projectName={project?.name?.trim() ? project.name : "Projeto"}
                        castMembers={castMembers}
                        sessions={sessions}
                        communicationDraft={communicationTabDraft}
                        onCommunicationDraftConsumed={
                          handleCommunicationDraftConsumed
                        }
                      />
                    </div>
                  </div>
                ) : null}
                {activeTab === "agenda" && (
                  <div className="flex-1 overflow-y-auto px-[24px] py-[20px]">
                    <div className="mx-auto flex max-w-[980px] flex-col gap-[12px]">
                      <div className="rounded-[10px] border border-[#252525] bg-[#1a1a1a] p-[14px]">
                        <h2 className="text-[14px] font-[600] text-[#e8e8e8]">
                          Sessões de gravação
                        </h2>
                        <p className="mt-[2px] text-[11px] text-[#505050]">
                          Cadastro de sessões: use a lista ou a visão por dia com
                          blocos de horário (sem calendário externo).
                        </p>
                      </div>

                      <div className="rounded-[10px] border border-[#252525] bg-[#1a1a1a] p-[14px]">
                        <div className="mb-[10px] flex items-center justify-between gap-[10px]">
                          <h3 className="text-[12px] font-[600] text-[#e8e8e8]">
                            {editingSessionId ? "Editar sessão" : "Nova sessão"}
                          </h3>
                          {editingSessionId ? (
                            <button
                              type="button"
                              onClick={resetSessionForm}
                              className="rounded-[5px] border border-[#2e2e2e] px-[10px] py-[5px] text-[11px] text-[#909090] hover:bg-[#252525]"
                            >
                              Cancelar edição
                            </button>
                          ) : null}
                        </div>

                        <div className="grid grid-cols-1 gap-[10px] md:grid-cols-2">
                          <div>
                            <label className={labelCls}>Título</label>
                            <input
                              className={inputCls}
                              value={sessionForm.title}
                              onChange={(e) => {
                                setSessionTitleTouched(true);
                                setSessionForm((prev) => ({
                                  ...prev,
                                  title: e.target.value,
                                }));
                              }}
                              placeholder="Ex: Gravação principal EP 01"
                            />
                          </div>
                          <div>
                            <label className={labelCls}>Dublador</label>
                            <select
                              className={inputCls}
                              value={sessionForm.castMemberId}
                              onChange={(e) =>
                                setSessionForm((prev) => ({
                                  ...prev,
                                  castMemberId: e.target.value,
                                }))
                              }
                            >
                              <option value="">Selecione</option>
                              {castMembers.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <SessionDatetimeField
                            label="Início"
                            labelClassName={labelCls}
                            inputClassName={inputCls}
                            value={{
                              dateYmd: sessionForm.startDate,
                              hour24: sessionForm.startHour24,
                              minute: sessionForm.startMinute,
                            }}
                            onChange={(v) =>
                              setSessionForm((prev) => ({
                                ...prev,
                                startDate: v.dateYmd,
                                startHour24: v.hour24,
                                startMinute: v.minute,
                              }))
                            }
                          />
                          <SessionDatetimeField
                            label="Fim"
                            labelClassName={labelCls}
                            inputClassName={inputCls}
                            value={{
                              dateYmd: sessionForm.endDate,
                              hour24: sessionForm.endHour24,
                              minute: sessionForm.endMinute,
                            }}
                            onChange={(v) =>
                              setSessionForm((prev) => ({
                                ...prev,
                                endDate: v.dateYmd,
                                endHour24: v.hour24,
                                endMinute: v.minute,
                              }))
                            }
                          />
                          <div className="md:col-span-2">
                            <p className={`${labelCls} mb-[6px]`}>
                              Sugestões de horário
                            </p>
                            {!sessionForm.castMemberId.trim() ? (
                              <p className="text-[11px] text-[#505050]">
                                Selecione um dublador para ver sugestões para o
                                dia considerado (data de início ou hoje).
                              </p>
                            ) : sessionTimeSuggestions.length > 0 ? (
                              <>
                                <div className="flex flex-wrap gap-[6px]">
                                  {sessionTimeSuggestions.map((sug, idx) => (
                                    <button
                                      key={`${sug.startIso}-${idx}`}
                                      type="button"
                                      onClick={() => {
                                        const sp = partsFromIso(sug.startIso);
                                        const ep = partsFromIso(sug.endIso);
                                        setSessionForm((prev) => ({
                                          ...prev,
                                          startDate: sp.dateYmd,
                                          startHour24: sp.hour24,
                                          startMinute: sp.minute,
                                          endDate: ep.dateYmd,
                                          endHour24: ep.hour24,
                                          endMinute: ep.minute,
                                        }));
                                        setSessionSuggestionAppliedHint(
                                          "Horário sugerido aplicado aos campos de início e fim.",
                                        );
                                      }}
                                      className="rounded-[5px] border border-[#333] bg-[#222] px-[8px] py-[4px] text-[11px] text-[#c8c8c8] hover:bg-[#2a2a2a]"
                                    >
                                      {sug.label}
                                    </button>
                                  ))}
                                </div>
                                {sessionSuggestionAppliedHint ? (
                                  <p className="mt-[6px] text-[11px] text-[#5DCAA5]">
                                    {sessionSuggestionAppliedHint}
                                  </p>
                                ) : null}
                              </>
                            ) : (
                              <p className="text-[11px] text-[#505050]">
                                Nenhum intervalo livre neste dia com a duração
                                atual. Ajuste data, horários ou cadastre
                                disponibilidade do dublador em Elenco (opcional).
                              </p>
                            )}
                          </div>
                          <div>
                            <label className={labelCls}>Status</label>
                            <select
                              className={inputCls}
                              value={sessionForm.status}
                              onChange={(e) =>
                                setSessionForm((prev) => ({
                                  ...prev,
                                  status: e.target
                                    .value as RecordingSessionStatus,
                                }))
                              }
                            >
                              {SESSION_STATUS_OPTIONS.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={labelCls}>Formato</label>
                            <select
                              className={inputCls}
                              value={sessionForm.format}
                              onChange={(e) =>
                                setSessionForm((prev) => ({
                                  ...prev,
                                  format: e.target
                                    .value as RecordingSessionFormat,
                                }))
                              }
                            >
                              {SESSION_FORMAT_OPTIONS.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className={labelCls}>
                              Episódios (opcional)
                            </label>
                            <div ref={episodeDropdownRef} className="relative">
                              <button
                                type="button"
                                onClick={() =>
                                  setEpisodeDropdownOpen((prev) => !prev)
                                }
                                className={`${inputCls} flex items-center justify-between`}
                              >
                                <span
                                  className={
                                    sessionForm.episodeIds.length > 0
                                      ? "text-[#e8e8e8]"
                                      : "text-[#909090]"
                                  }
                                >
                                  {selectedEpisodeLabel}
                                </span>
                                <span className="text-[#606060]">
                                  {episodeDropdownOpen ? "▲" : "▼"}
                                </span>
                              </button>
                              {episodeDropdownOpen ? (
                                <div className="absolute z-20 mt-[6px] max-h-[180px] w-full overflow-y-auto rounded-[6px] border border-[#2e2e2e] bg-[#111] p-[6px]">
                                  {episodes.length === 0 ? (
                                    <p className="px-[8px] py-[6px] text-[11px] text-[#606060]">
                                      Nenhum episódio disponível
                                    </p>
                                  ) : (
                                    episodes.map((ep) => {
                                      const checked =
                                        sessionForm.episodeIds.includes(ep.id);
                                      return (
                                        <label
                                          key={ep.id}
                                          className="flex cursor-pointer items-center gap-[8px] rounded-[4px] px-[8px] py-[6px] text-[12px] text-[#d6d6d6] hover:bg-[#1e1e1e]"
                                        >
                                          <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() =>
                                              setSessionForm((prev) => ({
                                                ...prev,
                                                episodeIds: checked
                                                  ? prev.episodeIds.filter(
                                                      (id) => id !== ep.id,
                                                    )
                                                  : [...prev.episodeIds, ep.id],
                                              }))
                                            }
                                          />
                                          <span>
                                            EP {ep.number}{" "}
                                            {ep.title?.trim()
                                              ? `- ${ep.title}`
                                              : ""}
                                          </span>
                                        </label>
                                      );
                                    })
                                  )}
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <div>
                            <label className={labelCls}>
                              Personagem (opcional)
                            </label>
                            <select
                              className={inputCls}
                              value={sessionForm.characterId}
                              onChange={(e) =>
                                setSessionForm((prev) => ({
                                  ...prev,
                                  characterId: e.target.value,
                                }))
                              }
                            >
                              <option value="">Nenhum</option>
                              {characters.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="mt-[10px]">
                          <label className={labelCls}>Notas</label>
                          <textarea
                            rows={3}
                            maxLength={2000}
                            className={`${inputCls} min-h-[74px] resize-y`}
                            value={sessionForm.notes}
                            onChange={(e) =>
                              setSessionForm((prev) => ({
                                ...prev,
                                notes: e.target.value,
                              }))
                            }
                            placeholder="Observações da sessão"
                          />
                        </div>
                        {sessionFeedback ? (
                          <p
                            className={`mt-[8px] text-[11px] ${
                              sessionFeedbackTone === "error"
                                ? "text-[#F09595]"
                                : sessionFeedbackTone === "info"
                                  ? "text-[#7EC8E3]"
                                  : "text-[#5DCAA5]"
                            }`}
                          >
                            {sessionFeedback}
                          </p>
                        ) : null}
                        <div className="mt-[12px] flex items-center gap-[8px]">
                          <button
                            type="button"
                            disabled={
                              sessionSaving || Boolean(sessionDeletingId)
                            }
                            onClick={() => void onSaveSession()}
                            className="rounded-[5px] border border-[#0F6E56] bg-[#1D9E75] px-[12px] py-[6px] text-[11px] font-[500] text-white hover:bg-[#0F6E56] disabled:opacity-40"
                          >
                            {sessionSaving
                              ? "Salvando sessão..."
                              : editingSessionId
                                ? "Salvar edição"
                                : "Criar sessão"}
                          </button>
                          <button
                            type="button"
                            disabled={
                              sessionSaving || Boolean(sessionDeletingId)
                            }
                            onClick={resetSessionForm}
                            className="rounded-[5px] border border-[#2e2e2e] px-[12px] py-[6px] text-[11px] text-[#909090] hover:bg-[#252525] disabled:opacity-40"
                          >
                            Limpar
                          </button>
                        </div>
                      </div>

                      <div className="rounded-[10px] border border-[#252525] bg-[#1a1a1a] p-[14px]">
                        <div className="mb-[8px] flex flex-wrap items-center justify-between gap-[8px]">
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-[10px]">
                            <h3 className="text-[12px] font-[600] text-[#e8e8e8]">
                              Sessões cadastradas
                              {sessionAgendaViewMode === "list" ? (
                                <>
                                  {" "}
                                  ({groupedSessions.visibleCount}/
                                  {groupedSessions.filteredCount})
                                </>
                              ) : (
                                <>
                                  {" "}
                                  ({groupedSessions.filteredCount})
                                </>
                              )}
                            </h3>
                            <div
                              className="inline-flex rounded-[6px] border border-[#2e2e2e] bg-[#141414] p-[2px]"
                              role="group"
                              aria-label="Modo de visualização da agenda"
                            >
                              <button
                                type="button"
                                onClick={() => setSessionAgendaViewMode("list")}
                                className={`rounded-[4px] px-[10px] py-[4px] text-[11px] font-[500] transition-colors ${
                                  sessionAgendaViewMode === "list"
                                    ? "bg-[#2a2a2a] text-[#e8e8e8]"
                                    : "text-[#707070] hover:text-[#b0b0b0]"
                                }`}
                              >
                                Lista
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setSessionAgendaViewMode("visual")
                                }
                                className={`rounded-[4px] px-[10px] py-[4px] text-[11px] font-[500] transition-colors ${
                                  sessionAgendaViewMode === "visual"
                                    ? "bg-[#2a2a2a] text-[#e8e8e8]"
                                    : "text-[#707070] hover:text-[#b0b0b0]"
                                }`}
                              >
                                Visual
                              </button>
                            </div>
                          </div>
                          <div className="grid w-full grid-cols-1 gap-[6px] md:w-auto md:grid-cols-3">
                            <select
                              className={inputCls}
                              value={sessionStatusFilter}
                              onChange={(e) =>
                                setSessionStatusFilter(
                                  e.target.value as
                                    | "ALL"
                                    | RecordingSessionStatus,
                                )
                              }
                            >
                              <option value="ALL">Todos os status</option>
                              {SESSION_STATUS_OPTIONS.map((s) => (
                                <option key={s.value} value={s.value}>
                                  {s.label}
                                </option>
                              ))}
                            </select>
                            <select
                              className={inputCls}
                              value={sessionCastFilter}
                              onChange={(e) =>
                                setSessionCastFilter(e.target.value)
                              }
                            >
                              <option value="ALL">Todos os dubladores</option>
                              {castMembers.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                            <select
                              className={inputCls}
                              value={sessionPeriodFilter}
                              onChange={(e) =>
                                setSessionPeriodFilter(
                                  e.target.value as SessionPeriodFilter,
                                )
                              }
                            >
                              <option value="ALL">Todos os períodos</option>
                              <option value="TODAY">Hoje</option>
                              <option value="NEXT_7_DAYS">
                                Próximos 7 dias
                              </option>
                              <option value="PAST">Passadas</option>
                            </select>
                          </div>
                        </div>
                        {sessionDeletingId ? (
                          <p className="mb-[8px] text-[11px] text-[#909090]">
                            Removendo sessão...
                          </p>
                        ) : null}
                        {sessionsLoading ? (
                          <p className="text-[12px] text-[#909090]">
                            Carregando lista de sessões...
                          </p>
                        ) : sessionsError ? (
                          <p className="text-[12px] text-[#F09595]">
                            {sessionsError}
                          </p>
                        ) : sessions.length === 0 ? (
                          <p className="text-[12px] text-[#505050]">
                            Nenhuma sessão cadastrada neste projeto. Use o
                            formulário acima para criar a primeira.
                          </p>
                        ) : groupedSessions.filteredCount === 0 ? (
                          <p className="text-[12px] text-[#505050]">
                            Nenhuma sessão corresponde aos filtros. Ajuste
                            status, dublador ou período.
                          </p>
                        ) : sessionAgendaViewMode === "visual" ? (
                          <div className="flex flex-col gap-[14px]">
                            {agendaVisualDayGroups.map((group) => {
                              const dayStats =
                                agendaDayConflictStatsByDayKey.get(
                                  group.dayKey,
                                );
                              return (
                                <div
                                  key={group.dayKey}
                                  className="flex flex-col gap-[8px]"
                                >
                                  <p className="text-[11px] font-[600] uppercase tracking-[0.06em] text-[#7b7b7b]">
                                    {group.label}
                                    {dayStats && dayStats.total > 0 ? (
                                      <span
                                        className={`ml-[6px] font-[500] normal-case tracking-normal ${dayConflictHeaderAccentClass(dayStats)}`}
                                      >
                                        · {dayStats.total}{" "}
                                        {dayStats.total === 1
                                          ? "conflito"
                                          : "conflitos"}
                                        {dayStats.hard > 0
                                          ? ` (${dayStats.hard} crítico${dayStats.hard === 1 ? "" : "s"})`
                                          : ""}
                                      </span>
                                    ) : null}
                                  </p>
                                  <div className="flex flex-col gap-[6px] border-l border-[#2e2e2e] pl-[12px]">
                                    {group.items.map((session) => {
                                      const isEditing =
                                        editingSessionId === session.id;
                                      const conflict =
                                        sessionConflictSummaryForId(
                                          sessionConflictSummaryById,
                                          session.id,
                                        );
                                      const badge =
                                        conflict.hasConflict &&
                                        conflict.severity
                                          ? agendaConflictBadgePresentation(
                                              conflict.severity,
                                            )
                                          : null;
                                      const conflictTooltip =
                                        conflict.detailLines.join(" · ");
                                      const cardDisabled =
                                        sessionSaving ||
                                        Boolean(sessionDeletingId);
                                      return (
                                        <div
                                          key={session.id}
                                          role="button"
                                          tabIndex={cardDisabled ? -1 : 0}
                                          aria-disabled={cardDisabled}
                                          className={`w-full rounded-[8px] border p-[10px] text-left transition-colors ${agendaConflictCardClassNames(
                                            conflict.severity,
                                            isEditing,
                                          )} ${
                                            cardDisabled
                                              ? "pointer-events-none opacity-40"
                                              : "cursor-pointer"
                                          }`}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter" || e.key === " ") {
                                              e.preventDefault();
                                              if (!cardDisabled)
                                                onEditSession(session);
                                            }
                                          }}
                                          onClick={() => {
                                            if (!cardDisabled)
                                              onEditSession(session);
                                          }}
                                        >
                                          <div className="flex flex-wrap items-start justify-between gap-[8px]">
                                            <p className="min-w-0 flex-1 truncate text-[12px] font-[600] text-[#e8e8e8]">
                                              {session.title}
                                            </p>
                                            <span className="shrink-0 text-[11px] tabular-nums text-[#909090]">
                                              {formatSessionTimeRange(
                                                session.startAt,
                                                session.endAt,
                                              )}
                                            </span>
                                          </div>
                                          <p className="mt-[4px] text-[11px] text-[#707070]">
                                            {session.castMember?.name ??
                                              "Dublador não informado"}
                                          </p>
                                          <div className="mt-[8px] flex flex-wrap items-center gap-[5px]">
                                            {badge ? (
                                              <span
                                                className={badge.className}
                                                title={
                                                  conflictTooltip ||
                                                  badge.label
                                                }
                                              >
                                                <span aria-hidden>⚠</span>
                                                {badge.label}
                                              </span>
                                            ) : null}
                                            <span
                                              className={`rounded-[4px] border px-[6px] py-[1px] text-[10px] font-[600] uppercase tracking-[0.04em] ${getSessionStatusBadgeClass(
                                                session.status,
                                              )}`}
                                            >
                                              {getSessionStatusLabel(
                                                session.status,
                                              )}
                                            </span>
                                            <span
                                              className={`rounded-[4px] border px-[6px] py-[1px] text-[10px] font-[600] uppercase tracking-[0.04em] ${getSessionFormatBadgeClass(
                                                session.format,
                                              )}`}
                                            >
                                              {getSessionFormatLabel(
                                                session.format,
                                              )}
                                            </span>
                                          </div>
                                          <div
                                            className="mt-[8px] flex justify-end border-t border-[#2a2a2a] pt-[8px]"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <button
                                              type="button"
                                              disabled={cardDisabled}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openCommunicationFromSession(
                                                  session,
                                                );
                                              }}
                                              className="rounded-[5px] border border-[#0d3d2a] px-[8px] py-[4px] text-[10px] text-[#5DCAA5] hover:bg-[#0a2018] disabled:opacity-40"
                                            >
                                              Registrar comunicação
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-[8px]">
                            {groupedSessions.groups.map((group) => {
                              const dayStats =
                                agendaDayConflictStatsByDayKey.get(
                                  group.dayKey,
                                );
                              return (
                                <div
                                  key={group.dayKey}
                                  className="flex flex-col gap-[8px]"
                                >
                                  <p className="text-[11px] font-[600] uppercase tracking-[0.06em] text-[#7b7b7b]">
                                    {group.label}
                                    {dayStats && dayStats.total > 0 ? (
                                      <span
                                        className={`ml-[6px] font-[500] normal-case tracking-normal ${dayConflictHeaderAccentClass(dayStats)}`}
                                      >
                                        · {dayStats.total}{" "}
                                        {dayStats.total === 1
                                          ? "conflito"
                                          : "conflitos"}
                                        {dayStats.hard > 0
                                          ? ` (${dayStats.hard} crítico${dayStats.hard === 1 ? "" : "s"})`
                                          : ""}
                                      </span>
                                    ) : null}
                                  </p>
                                  {group.items.map((session) => {
                                  const epSummaries =
                                    session.episodes &&
                                    session.episodes.length > 0
                                      ? session.episodes.map((e) => ({
                                          key: e.id,
                                          number: e.number,
                                          title: e.title,
                                        }))
                                      : session.episodeId
                                        ? (() => {
                                            const local = episodes.find(
                                              (x) => x.id === session.episodeId,
                                            );
                                            if (local) {
                                              return [
                                                {
                                                  key: local.id,
                                                  number: local.number,
                                                  title: local.title,
                                                },
                                              ];
                                            }
                                            if (session.episode) {
                                              return [
                                                {
                                                  key: session.episode.id,
                                                  number: session.episode.number,
                                                  title: session.episode.title,
                                                },
                                              ];
                                            }
                                            return [];
                                          })()
                                        : [];
                                  const ch = characters.find(
                                    (item) => item.id === session.characterId,
                                  );
                                  const listEditing =
                                    editingSessionId === session.id;
                                  const listConflict =
                                    sessionConflictSummaryForId(
                                      sessionConflictSummaryById,
                                      session.id,
                                    );
                                  const listBadge =
                                    listConflict.hasConflict &&
                                    listConflict.severity
                                      ? agendaConflictListBadgePresentation(
                                          listConflict.severity,
                                        )
                                      : null;
                                  const listConflictTooltip =
                                    listConflict.detailLines.join(" · ");
                                  return (
                                    <div
                                      key={session.id}
                                      className={`rounded-[8px] border p-[10px] ${agendaConflictCardClassNames(
                                        listConflict.severity,
                                        listEditing,
                                      )}`}
                                    >
                                      <div className="flex flex-wrap items-start justify-between gap-[8px]">
                                        <div className="min-w-0">
                                          <p className="truncate text-[13px] font-[600] text-[#e8e8e8]">
                                            {session.title}
                                          </p>
                                          <p className="mt-[2px] text-[11px] text-[#909090]">
                                            {session.castMember?.name ??
                                              "Dublador não informado"}
                                          </p>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-[6px]">
                                          <button
                                            type="button"
                                            disabled={
                                              sessionSaving ||
                                              Boolean(sessionDeletingId)
                                            }
                                            onClick={() =>
                                              onEditSession(session)
                                            }
                                            className="rounded-[5px] border border-[#2e2e2e] px-[8px] py-[4px] text-[10px] text-[#909090] hover:bg-[#252525] disabled:opacity-40"
                                          >
                                            Editar
                                          </button>
                                          <button
                                            type="button"
                                            disabled={
                                              sessionSaving ||
                                              Boolean(sessionDeletingId)
                                            }
                                            onClick={() =>
                                              openCommunicationFromSession(
                                                session,
                                              )
                                            }
                                            className="rounded-[5px] border border-[#0d3d2a] px-[8px] py-[4px] text-[10px] text-[#5DCAA5] hover:bg-[#0a2018] disabled:opacity-40"
                                          >
                                            Registrar comunicação
                                          </button>
                                          <button
                                            type="button"
                                            disabled={
                                              sessionSaving ||
                                              Boolean(sessionDeletingId)
                                            }
                                            onClick={() =>
                                              void onDeleteSession(session)
                                            }
                                            className="rounded-[5px] border border-[#5a1515] px-[8px] py-[4px] text-[10px] text-[#F09595] hover:bg-[#2a0a0a] disabled:opacity-40"
                                          >
                                            {sessionDeletingId === session.id
                                              ? "Removendo sessão..."
                                              : "Remover"}
                                          </button>
                                        </div>
                                      </div>
                                      <div className="mt-[8px] flex flex-wrap gap-[6px] text-[10px] text-[#606060]">
                                        <span>
                                          Início:{" "}
                                          {formatEpisodeTimestamp(
                                            session.startAt,
                                          ) ?? "-"}
                                        </span>
                                        <span>
                                          Fim:{" "}
                                          {formatEpisodeTimestamp(
                                            session.endAt,
                                          ) ?? "-"}
                                        </span>
                                        <span
                                          className={`rounded-[10px] border px-[6px] py-[1px] ${getSessionStatusBadgeClass(
                                            session.status,
                                          )}`}
                                        >
                                          Status:{" "}
                                          {getSessionStatusLabel(
                                            session.status,
                                          )}
                                        </span>
                                        <span
                                          className={`rounded-[10px] border px-[6px] py-[1px] ${getSessionFormatBadgeClass(
                                            session.format,
                                          )}`}
                                        >
                                          Formato:{" "}
                                          {getSessionFormatLabel(
                                            session.format,
                                          )}
                                        </span>
                                        {listBadge ? (
                                          <span
                                            className={listBadge.className}
                                            title={
                                              listConflictTooltip ||
                                              listBadge.label
                                            }
                                          >
                                            <span aria-hidden>⚠</span>
                                            {listBadge.label}
                                          </span>
                                        ) : null}
                                        {epSummaries.length === 1 ? (
                                          <span>
                                            Episódio: EP{" "}
                                            {epSummaries[0].number ?? "—"}
                                            {epSummaries[0].title?.trim()
                                              ? ` - ${epSummaries[0].title}`
                                              : ""}
                                          </span>
                                        ) : epSummaries.length > 1 ? (
                                          <span>
                                            Episódios:{" "}
                                            {epSummaries.map((e, idx) => (
                                              <span key={e.key}>
                                                {idx > 0 ? ", " : ""}
                                                EP {e.number ?? "—"}
                                                {e.title?.trim()
                                                  ? ` (${e.title})`
                                                  : ""}
                                              </span>
                                            ))}
                                          </span>
                                        ) : null}
                                        {ch ? (
                                          <span>Personagem: {ch.name}</span>
                                        ) : null}
                                      </div>
                                      {session.notes?.trim() ? (
                                        <p className="mt-[6px] text-[11px] text-[#909090]">
                                          {session.notes}
                                        </p>
                                      ) : null}
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })}
                          {groupedSessions.hasMore ? (
                            <div className="pt-[4px]">
                              <button
                                type="button"
                                onClick={() =>
                                  setSessionVisibleCount(
                                    (prev) => prev + AGENDA_PAGE_SIZE,
                                  )
                                }
                                className="rounded-[5px] border border-[#2e2e2e] px-[12px] py-[6px] text-[11px] text-[#909090] hover:bg-[#252525]"
                              >
                                Carregar mais
                              </button>
                            </div>
                          ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {activeTab !== "info" &&
                activeTab !== "elenco" &&
                activeTab !== "episodios" &&
                activeTab !== "agenda" &&
                activeTab !== "comunicacao" ? (
                  <div className="flex min-h-[200px] items-center justify-center rounded-[10px] border border-[#252525] bg-[#1a1a1a] py-16 text-[13px] text-[#444]">
                    Em breve
                  </div>
                ) : null}
              </div>
            </div>

            {activeTab === "info" ? (
              <div className="flex shrink-0 items-center gap-[8px] border-t border-[#1e1e1e] bg-[#141414] px-[20px] py-[10px] sm:px-[24px]">
                <div className="flex-1" />
                {savedMsg ? (
                  <span className="text-[11px] text-[#5DCAA5]">
                    ✓ Salvo com sucesso
                  </span>
                ) : null}
                {isDirty && !savedMsg ? (
                  <span className="text-[11px] text-[#EF9F27]">
                    ● Alterações não salvas
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => reset(getEditDefaults(project))}
                  disabled={isSubmitting || !isDirty}
                  className="rounded-[5px] border border-[#2e2e2e] px-[12px] py-[6px] text-[11px] text-[#606060] transition-colors hover:bg-[#252525] disabled:opacity-40"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !isDirty}
                  className="rounded-[5px] border border-[#0F6E56] bg-[#1D9E75] px-[14px] py-[6px] text-[11px] font-[500] text-white transition-colors hover:bg-[#0F6E56] disabled:opacity-40"
                >
                  {isSubmitting ? "Salvando…" : "Salvar alterações"}
                </button>
              </div>
            ) : null}
          </div>
        </form>
        {charModalOpen ? (
          <CharacterModal
            character={editingChar}
            projectId={id}
            castMembers={castMembers}
            onClose={() => {
              setCharModalOpen(false);
              setEditingChar(null);
            }}
            onSaved={onCharSaved}
          />
        ) : null}
        {clientModalOpen ? (
          <ClientQuickModal
            onClose={() => setClientModalOpen(false)}
            onCreated={(c) => {
              setValue("client", c.name, { shouldDirty: true });
              setValue("clientId", c.id, { shouldDirty: true });
              setClientListRefresh((k) => k + 1);
              setClientModalOpen(false);
            }}
          />
        ) : null}
      </div>
    </PageShell>
  );
}
