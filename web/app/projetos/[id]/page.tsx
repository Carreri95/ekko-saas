"use client";

import "../projetos.css";

import { PageShell } from "@/app/components/page-shell";
import { useConfirm } from "@/app/components/confirm-provider";
import { DateInput } from "@/app/components/date-input";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { CharacterCard } from "./components/character-card";
import { CharacterDrawer } from "./components/character-drawer";
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
  const confirm = useConfirm();
  const id = typeof params.id === "string" ? params.id : "";

  const [project, setProject] = useState<DubbingProjectDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("info");
  const [savedMsg, setSavedMsg] = useState(false);
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientListRefresh, setClientListRefresh] = useState(0);
  const [characters, setCharacters] = useState<ProjectCharacterDto[]>([]);
  const [castMembers, setCastMembers] = useState<CastMemberDto[]>([]);
  const [charDrawerOpen, setCharDrawerOpen] = useState(false);
  const [editingChar, setEditingChar] = useState<ProjectCharacterDto | null>(
    null,
  );

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

  useEffect(() => {
    if (activeTab === "elenco") {
      void loadCharacters();
      void loadCastMembers();
    }
  }, [activeTab, loadCharacters, loadCastMembers]);

  const openNewChar = () => {
    setEditingChar(null);
    setCharDrawerOpen(true);
  };
  const openEditChar = (c: ProjectCharacterDto) => {
    setEditingChar(c);
    setCharDrawerOpen(true);
  };
  const onCharSaved = () => {
    setCharDrawerOpen(false);
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
                            gridTemplateColumns: "repeat(3,1fr)",
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
                {activeTab !== "info" && activeTab !== "elenco" ? (
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
        {charDrawerOpen ? (
          <CharacterDrawer
            character={editingChar}
            projectId={id}
            castMembers={castMembers}
            onClose={() => {
              setCharDrawerOpen(false);
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
