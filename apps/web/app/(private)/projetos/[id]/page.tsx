"use client";

import "../projetos.css";

import { PageShell } from "@/app/components/page-shell";
import { useConfirm } from "@/app/components/confirm-provider";
import { DateInput } from "@/app/components/date-input";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { createPortal } from "react-dom";
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
import type {
  DubbingEpisodeDto,
  DubbingEpisodeStatus,
} from "@/app/types/dubbing-episode";
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

const TABS = [
  { id: "info", label: "Informações", enabled: true },
  { id: "elenco", label: "Elenco", enabled: true },
  { id: "episodios", label: "Episódios", enabled: true },
  { id: "agenda", label: "Agenda", enabled: false },
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

const EPISODE_STATUS_BADGE: Record<
  DubbingEpisodeStatus,
  { className: string; label: string }
> = {
  PENDING: {
    className:
      "border border-[#404040] bg-[#2a2a2a] text-[#909090]",
    label: "Pendente",
  },
  TRANSCRIBING: {
    className:
      "border border-[#5c4a20] bg-[#3d3520] text-[#EF9F27]",
    label: "Em transcrição",
  },
  DONE: {
    className:
      "border border-[#0F6E56] bg-[#0d3d2a] text-[#5DCAA5]",
    label: "Concluído",
  },
};

function isoToInput(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
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
  const [activeTab, setActiveTab] = useState<TabId>(
    searchParams.get("tab") === "episodios" ? "episodios" : "info",
  );
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
  const [openEpisodeMenuId, setOpenEpisodeMenuId] = useState<string | null>(
    null,
  );
  /** Posição do dropdown (portal + fixed) — evita recorte por `overflow-y-auto` do painel. */
  const [episodeMenuFixed, setEpisodeMenuFixed] = useState<{
    top: number;
    right: number;
  } | null>(null);
  const episodesTabScrollRef = useRef<HTMLDivElement | null>(null);
  const [exportSrtsBusy, setExportSrtsBusy] = useState(false);
  const [exportSrtsError, setExportSrtsError] = useState<string | null>(null);
  const audioTargetEpRef = useRef<string | null>(null);
  const audioFileInputRef = useRef<HTMLInputElement>(null);
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
    return () => {
      const polls = transcriptionPollRef.current;
      for (const iv of Object.values(polls)) {
        clearInterval(iv);
      }
      transcriptionPollRef.current = {};
    };
  }, []);

  useEffect(() => {
    const onDocPointerDown = (e: PointerEvent) => {
      const target = e.target;
      if (!(target instanceof Element)) {
        setOpenEpisodeMenuId(null);
        setEpisodeMenuFixed(null);
        return;
      }
      const inside =
        target.closest("[data-episode-menu-root='1']") ||
        target.closest("[data-episode-menu-portal='1']");
      if (!inside) {
        setOpenEpisodeMenuId(null);
        setEpisodeMenuFixed(null);
      }
    };
    document.addEventListener("pointerdown", onDocPointerDown);
    return () => document.removeEventListener("pointerdown", onDocPointerDown);
  }, []);

  useEffect(() => {
    if (!openEpisodeMenuId) return;
    const onScrollOrResize = () => {
      setOpenEpisodeMenuId(null);
      setEpisodeMenuFixed(null);
    };
    window.addEventListener("resize", onScrollOrResize);
    const el = episodesTabScrollRef.current;
    el?.addEventListener("scroll", onScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      el?.removeEventListener("scroll", onScrollOrResize);
    };
  }, [openEpisodeMenuId]);

  useEffect(() => {
    setOpenEpisodeMenuId(null);
    setEpisodeMenuFixed(null);
  }, [activeTab]);

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
            status: "DONE",
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
            prev.map((e) =>
              e.id === epId ? { ...e, status: "PENDING" } : e,
            ),
          );
          const msg =
            data.errorMessage?.trim() || "A transcrição falhou.";
          setEpisodeInlineError((prev) => ({ ...prev, [epId]: msg }));
        }
      };
      transcriptionPollRef.current[epId] = setInterval(
        () => void tick(),
        3000,
      );
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
          ((episodeDoneCount + episodeTranscribingCount * 0.5) /
            episodeTotal) *
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
                          (field.value ?? project.status) as DubbingProjectStatus
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
                              ID:{" "}
                              {id.length > 12 ? `${id.slice(0, 8)}…` : id}
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
                                className={
                                  errors.name ? inputErrCls : inputCls
                                }
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
                              <label
                                className={labelCls}
                                htmlFor="edit-start"
                              >
                                Início{" "}
                                <span className="text-[#E24B4A]">*</span>
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
                                      errors.startDate
                                        ? inputErrCls
                                        : inputCls
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
                                      errors.deadline
                                        ? inputErrCls
                                        : inputCls
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
                              <p className={errorCls}>
                                {errors.notes.message}
                              </p>
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
                              <label
                                className={labelCls}
                                htmlFor="edit-value"
                              >
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
                            {characters.filter((c) => c.castMemberId).length}{" "}
                            dublador
                            {characters.filter((c) => c.castMemberId).length !== 1
                              ? "es"
                              : ""}{" "}
                            escalado
                            {characters.filter((c) => c.castMemberId).length !== 1
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
                              onEdit={openEditChar}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {activeTab === "episodios" && (
                  <div
                    ref={episodesTabScrollRef}
                    className="flex-1 overflow-y-auto px-[24px] py-[20px]"
                  >
                    <div className="mx-auto" style={{ maxWidth: 900 }}>
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
                          <div className="mb-[16px] overflow-hidden rounded-[10px] border border-[#252525] bg-[#1a1a1a]">
                            <div className="border-b border-[#252525] px-[14px] py-[10px]">
                              <span className="text-[12px] font-[600] text-[#e8e8e8]">
                                Progresso
                              </span>
                            </div>
                            <div className="p-[14px]">
                              <p className="mb-[10px] text-[12px] text-[#909090]">
                                {episodeDoneCount} de {episodeTotal} episódios
                                concluídos
                              </p>
                              <div className="h-[8px] w-full overflow-hidden rounded-full bg-[#252525]">
                                <div
                                  className="h-full rounded-full bg-[#1D9E75] transition-[width]"
                                  style={{
                                    width: `${episodeProgressPct}%`,
                                  }}
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
                            <div className="overflow-visible rounded-[10px] border border-[#252525] bg-[#1a1a1a]">
                              <div className="border-b border-[#252525] px-[14px] py-[10px]">
                                <span className="text-[12px] font-[600] text-[#e8e8e8]">
                                  Lista ({episodes.length})
                                </span>
                              </div>
                              <ul className="divide-y divide-[#252525]">
                                {episodes.map((ep) => {
                                  const title =
                                    ep.title?.trim() ||
                                    `Episódio ${ep.number}`;
                                  const badge = EPISODE_STATUS_BADGE[ep.status];
                                  const busy =
                                    ep.status === "TRANSCRIBING" ||
                                    uploadingEpisodeId === ep.id;
                                  const inlineErr = episodeInlineError[ep.id];
                                  const isMenuOpen = openEpisodeMenuId === ep.id;
                                  const closeEpisodeMenu = () => {
                                    setOpenEpisodeMenuId(null);
                                    setEpisodeMenuFixed(null);
                                  };

                                  const episodeMenuPanel =
                                    isMenuOpen &&
                                    episodeMenuFixed &&
                                    typeof document !== "undefined"
                                      ? createPortal(
                                          <div
                                            data-episode-menu-portal="1"
                                            className="fixed z-[9999] min-w-[170px] overflow-hidden rounded-[8px] border border-[#2e2e2e] bg-[#141414] shadow-[0_8px_24px_rgba(0,0,0,0.45)]"
                                            style={{
                                              top: episodeMenuFixed.top,
                                              right: episodeMenuFixed.right,
                                            }}
                                          >
                                            {ep.status === "PENDING" &&
                                            !ep.audioFileId ? (
                                              <button
                                                type="button"
                                                disabled={busy}
                                                onClick={() => {
                                                  closeEpisodeMenu();
                                                  onPickEpisodeAudio(ep.id);
                                                }}
                                                className="block w-full px-[10px] py-[8px] text-left text-[11px] text-[#cfcfcf] transition-colors hover:bg-[#252525] disabled:cursor-not-allowed disabled:opacity-40"
                                              >
                                                ↑ Enviar áudio
                                              </button>
                                            ) : null}

                                            {ep.status === "PENDING" &&
                                            ep.audioFileId ? (
                                              <>
                                                <button
                                                  type="button"
                                                  disabled={busy}
                                                  onClick={() => {
                                                    closeEpisodeMenu();
                                                    onPickEpisodeAudio(ep.id);
                                                  }}
                                                  className="block w-full px-[10px] py-[8px] text-left text-[11px] text-[#cfcfcf] transition-colors hover:bg-[#252525] disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                  ↑ Substituir áudio
                                                </button>
                                                <button
                                                  type="button"
                                                  disabled={busy}
                                                  onClick={() => {
                                                    closeEpisodeMenu();
                                                    void onGenerateEpisodeSrt(ep);
                                                  }}
                                                  className="block w-full border-t border-[#252525] px-[10px] py-[8px] text-left text-[11px] text-[#5DCAA5] transition-colors hover:bg-[#252525] disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                  Gerar SRT
                                                </button>
                                              </>
                                            ) : null}

                                            {ep.status === "TRANSCRIBING" ? (
                                              <span className="block w-full cursor-not-allowed px-[10px] py-[8px] text-left text-[11px] text-[#707070]">
                                                Transcrevendo...
                                              </span>
                                            ) : null}

                                            {ep.status === "DONE" ? (
                                              <>
                                                <button
                                                  type="button"
                                                  disabled={!ep.subtitleFileId}
                                                  onClick={() => {
                                                    if (!ep.subtitleFileId) return;
                                                    closeEpisodeMenu();
                                                    router.push(
                                                      `/subtitle-file-edit?fileId=${encodeURIComponent(ep.subtitleFileId)}&episodeId=${encodeURIComponent(ep.id)}&projectId=${encodeURIComponent(id)}`,
                                                    );
                                                  }}
                                                  className="block w-full px-[10px] py-[8px] text-left text-[11px] text-[#5DCAA5] transition-colors hover:bg-[#252525] disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                  Abrir editor
                                                </button>
                                                <button
                                                  type="button"
                                                  disabled={busy}
                                                  onClick={() => {
                                                    closeEpisodeMenu();
                                                    onPickEpisodeAudio(ep.id);
                                                  }}
                                                  className="block w-full border-t border-[#252525] px-[10px] py-[8px] text-left text-[11px] text-[#cfcfcf] transition-colors hover:bg-[#252525] disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                  ↑ Substituir áudio
                                                </button>
                                                <button
                                                  type="button"
                                                  disabled={busy}
                                                  onClick={() => {
                                                    closeEpisodeMenu();
                                                    void onGenerateEpisodeSrt(ep);
                                                  }}
                                                  className="block w-full border-t border-[#252525] px-[10px] py-[8px] text-left text-[11px] text-[#5DCAA5] transition-colors hover:bg-[#252525] disabled:cursor-not-allowed disabled:opacity-40"
                                                >
                                                  Gerar SRT
                                                </button>
                                              </>
                                            ) : null}
                                          </div>,
                                          document.body,
                                        )
                                      : null;

                                  return (
                                    <li
                                      key={ep.id}
                                      className="flex items-start justify-between gap-[10px] px-[14px] py-[12px]"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <div className="flex min-w-0 flex-row flex-wrap items-center gap-x-2 gap-y-1">
                                          <span className="shrink-0 font-mono text-[11px] text-[#505050]">
                                            #{ep.number}
                                          </span>
                                          {ep.status === "TRANSCRIBING" ? (
                                            <span className="inline-flex shrink-0 items-center gap-[6px] text-[10px] font-[600] uppercase tracking-[0.05em] text-[#EF9F27]">
                                              <span
                                                className="inline-block h-[12px] w-[12px] animate-spin rounded-full border-2 border-[#EF9F27] border-t-transparent"
                                                aria-hidden
                                              />
                                              Em transcrição
                                            </span>
                                          ) : (
                                            <span
                                              className={`inline-flex shrink-0 rounded-[4px] px-[8px] py-[2px] text-[10px] font-[600] uppercase tracking-[0.05em] ${badge.className}`}
                                            >
                                              {badge.label}
                                            </span>
                                          )}
                                          {ep.editedAt !== null ? (
                                            <span className="inline-flex shrink-0 rounded-[4px] border border-[#0F6E56] bg-[#0d3d2a] px-[8px] py-[2px] text-[10px] font-[600] uppercase tracking-[0.05em] text-[#5DCAA5]">
                                              Editado
                                            </span>
                                          ) : null}
                                          <span
                                            className="min-w-0 flex-1 truncate text-[13px] font-[500] text-[#e8e8e8]"
                                            title={title}
                                          >
                                            {title}
                                          </span>
                                        </div>
                                        {inlineErr ? (
                                          <p className="mt-[6px] text-[11px] text-[#F09595]">
                                            {inlineErr}
                                          </p>
                                        ) : null}
                                      </div>
                                      <div
                                        className="relative flex shrink-0 items-start justify-end pt-[1px]"
                                        data-episode-menu-root="1"
                                      >
                                        <button
                                          type="button"
                                          aria-label={`Ações do episódio ${ep.number}`}
                                          aria-expanded={isMenuOpen}
                                          onClick={(e) => {
                                            if (openEpisodeMenuId === ep.id) {
                                              closeEpisodeMenu();
                                              return;
                                            }
                                            const rect =
                                              e.currentTarget.getBoundingClientRect();
                                            setEpisodeMenuFixed({
                                              top: rect.bottom + 6,
                                              right:
                                                window.innerWidth - rect.right,
                                            });
                                            setOpenEpisodeMenuId(ep.id);
                                          }}
                                          className="rounded-[5px] border border-[#2e2e2e] bg-[#141414] px-[9px] py-[5px] text-[12px] leading-none text-[#909090] transition-colors hover:bg-[#252525] hover:text-[#e8e8e8]"
                                        >
                                          •••
                                        </button>
                                        {episodeMenuPanel}
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
                {activeTab !== "info" &&
                activeTab !== "elenco" &&
                activeTab !== "episodios" ? (
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
