"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CommunicationPreferenceChannelToggle } from "@/app/components/communication-channel-chip";
import { PageShell } from "@/app/components/page-shell";
import { useConfirm } from "@/app/components/confirm-provider";
import { formatBrazilPhone, normalizePhoneForStorage } from "@/src/lib/phone-format";
import { formatCnpj, formatCpf } from "@/src/lib/document-format";
import {
  collaboratorFormSchema,
  type CollaboratorFormData,
  type CollaboratorFormInput,
} from "../schemas";
import type { CollaboratorDto, CollaboratorRole } from "@/app/types/collaborator";
import { COLLABORATOR_ROLE_LABEL } from "../role-labels";
import "../../projetos/projetos.css";

const TABS = [{ id: "info", label: "Informações", enabled: true }] as const;
type TabId = (typeof TABS)[number]["id"];

const inputCls =
  "w-full min-h-[36px] rounded-[6px] border border-[#2e2e2e] bg-[#111] px-[10px] py-[7px] text-[13px] text-[#e8e8e8] outline-none placeholder:text-[#505050] focus:border-[#1D9E75] transition-colors";
const inputErrCls =
  "w-full min-h-[36px] rounded-[6px] border border-[#E24B4A] bg-[#111] px-[10px] py-[7px] text-[13px] text-[#e8e8e8] outline-none focus:border-[#E24B4A] transition-colors";
const labelCls =
  "mb-[5px] block text-[10px] font-[600] uppercase tracking-[0.07em] text-[#505050]";
const errorCls = "mt-[3px] text-[11px] text-[#F09595]";

function getDefaults(c: CollaboratorDto): CollaboratorFormInput {
  return {
    name: c.name,
    cpf: formatCpf(c.cpf ?? ""),
    cnpj: formatCnpj(c.cnpj ?? ""),
    razaoSocial: c.razaoSocial ?? "",
    role: c.role,
    email: c.email ?? "",
    whatsapp: formatBrazilPhone(c.whatsapp ?? ""),
    prefersEmail: c.prefersEmail ?? true,
    prefersWhatsapp: c.prefersWhatsapp ?? false,
  };
}

export default function CollaboratorEditPage() {
  const params = useParams();
  const router = useRouter();
  const confirm = useConfirm();
  const id = typeof params.id === "string" ? params.id : "";

  const [collaborator, setCollaborator] = useState<CollaboratorDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("info");
  const [savedMsg, setSavedMsg] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/collaborators/${id}`);
      if (!res.ok) {
        setNotFound(true);
        setCollaborator(null);
        return;
      }
      const data = (await res.json()) as { collaborator: CollaboratorDto };
      setCollaborator(data.collaborator);
    } catch {
      setNotFound(true);
      setCollaborator(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    clearErrors,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CollaboratorFormInput, unknown, CollaboratorFormData>({
    resolver: zodResolver(collaboratorFormSchema) as Resolver<
      CollaboratorFormInput,
      unknown,
      CollaboratorFormData
    >,
    mode: "all",
  });

  useEffect(() => {
    if (collaborator) {
      reset(getDefaults(collaborator));
      clearErrors();
    }
  }, [collaborator, reset, clearErrors]);

  const prefersEmail = watch("prefersEmail");
  const prefersWhatsapp = watch("prefersWhatsapp");

  const onSubmit = async (data: CollaboratorFormData) => {
    clearErrors("root");
    const res = await fetch(`/api/collaborators/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name.trim(),
        cpf: data.cpf,
        cnpj: data.cnpj,
        razaoSocial: data.razaoSocial.trim(),
        role: data.role,
        email: data.email.trim(),
        whatsapp: normalizePhoneForStorage(data.whatsapp) ?? "",
        prefersEmail: data.prefersEmail,
        prefersWhatsapp: data.prefersWhatsapp,
      }),
    });

    if (res.status === 409) {
      const conflict = (await res.json()) as { error: string; field: string | null };
      if (conflict.field === "email") setError("email", { message: conflict.error });
      else if (conflict.field === "whatsapp")
        setError("whatsapp", { message: conflict.error });
      else setError("root", { message: conflict.error });
      return;
    }

    if (!res.ok) {
      setError("root", { message: "Erro ao salvar. Tente novamente." });
      return;
    }
    const updated = (await res.json()) as { collaborator: CollaboratorDto };
    setCollaborator(updated.collaborator);
    reset(getDefaults(updated.collaborator));
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 3000);
  };

  const handleDelete = async () => {
    if (!collaborator) return;
    const ok = await confirm({
      title: "Remover colaborador",
      description: `Confirma remover "${collaborator.name}"? Esta ação não pode ser desfeita.`,
      variant: "danger",
      confirmLabel: "Sim, remover",
      cancelLabel: "Não",
    });
    if (!ok) return;
    const res = await fetch(`/api/collaborators/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/colaboradores");
  };

  if (loading) {
    return (
      <PageShell title="Carregando…" section="gestao">
        <div className="flex h-full min-h-[200px] items-center justify-center text-[13px] text-[#505050]">
          Carregando colaborador…
        </div>
      </PageShell>
    );
  }

  if (notFound || !collaborator) {
    return (
      <PageShell title="Não encontrado" section="gestao">
        <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-4">
          <p className="text-[13px] text-[#505050]">
            Este colaborador não existe ou foi removido.
          </p>
          <button
            type="button"
            onClick={() => router.push("/colaboradores")}
            className="rounded-[6px] border border-[#2e2e2e] bg-[#252525] px-[14px] py-[6px] text-[12px] text-[#909090] hover:bg-[#2a2a2a]"
          >
            ← Voltar aos colaboradores
          </button>
        </div>
      </PageShell>
    );
  }

  const roleSubtitle = COLLABORATOR_ROLE_LABEL[collaborator.role];

  return (
    <PageShell
      title={collaborator.name}
      section="gestao"
      subtitle={`· ${roleSubtitle}`}
      noScroll
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center gap-[6px] border-b border-[#1e1e1e] bg-[#141414] px-[24px] py-[7px] text-[11px]">
          <button
            type="button"
            onClick={() => router.push("/colaboradores")}
            className="text-[#505050] transition-colors hover:text-[#909090]"
          >
            ← Colaboradores
          </button>
          <span className="text-[#2e2e2e]">/</span>
          <span className="max-w-[min(100%,300px)] truncate text-[#909090]">
            {collaborator.name}
          </span>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex min-h-0 flex-1 flex-row"
        >
          <aside className="flex w-[200px] shrink-0 flex-col border-r border-[#1e1e1e] bg-[#141414] px-[8px] py-[12px]">
            <div className="mb-[4px] px-[8px] text-[9px] font-[700] uppercase tracking-[0.1em] text-[#333]">
              Este colaborador
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
                    : "text-[#505050] hover:bg-[#1e1e1e] hover:text-[#909090]"
                }`}
              >
                <span>{tab.label}</span>
              </button>
            ))}
            <div className="mt-auto">
              <div className="my-[8px] h-px bg-[#1e1e1e]" />
              <div className="mb-[4px] px-[8px] text-[9px] font-[700] uppercase tracking-[0.1em] text-[#333]">
                Perigo
              </div>
              <button
                type="button"
                onClick={() => void handleDelete()}
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
                Remover colaborador
              </button>
            </div>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-[20px] py-[20px] sm:px-[28px] sm:py-[24px]">
              {activeTab === "info" && (
                <div className="flex flex-col gap-[14px]">
                  {errors.root ? (
                    <div className="rounded-[5px] border border-[#5a1515] bg-[#2a0a0a] px-[10px] py-[8px] text-[11px] text-[#F09595]">
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
                            ID: {id.slice(0, 8)}…
                          </span>
                        </div>
                        <div className="flex flex-col gap-[10px] p-[14px]">
                          <div>
                            <label className={labelCls} htmlFor="colab-name">
                              Nome completo <span className="text-[#E24B4A]">*</span>
                            </label>
                            <input
                              id="colab-name"
                              {...register("name")}
                              className={errors.name ? inputErrCls : inputCls}
                              placeholder="Ex: Ana Souza"
                            />
                            {errors.name ? <p className={errorCls}>{errors.name.message}</p> : null}
                          </div>
                          <div>
                            <label className={labelCls} htmlFor="colab-role">
                              Função <span className="text-[#E24B4A]">*</span>
                            </label>
                            <select
                              id="colab-role"
                              {...register("role")}
                              className={errors.role ? inputErrCls : inputCls}
                            >
                              {(Object.keys(COLLABORATOR_ROLE_LABEL) as CollaboratorRole[]).map(
                                (role) => (
                                  <option key={role} value={role}>
                                    {COLLABORATOR_ROLE_LABEL[role]}
                                  </option>
                                ),
                              )}
                            </select>
                            {errors.role ? <p className={errorCls}>{errors.role.message}</p> : null}
                          </div>
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-[10px] border border-[#252525] bg-[#1a1a1a]">
                        <div className="border-b border-[#252525] px-[14px] py-[10px]">
                          <span className="text-[12px] font-[600] text-[#e8e8e8]">
                            Dados fiscais
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-[10px] p-[14px]">
                          <div>
                            <label className={labelCls} htmlFor="colab-cpf">
                              CPF
                            </label>
                            <Controller
                              name="cpf"
                              control={control}
                              render={({ field }) => (
                                <input
                                  id="colab-cpf"
                                  name={field.name}
                                  inputMode="numeric"
                                  value={field.value ?? ""}
                                  onChange={(e) => field.onChange(formatCpf(e.target.value))}
                                  onBlur={field.onBlur}
                                  ref={field.ref}
                                  className={errors.cpf ? inputErrCls : inputCls}
                                  placeholder="000.000.000-00"
                                />
                              )}
                            />
                            {errors.cpf ? <p className={errorCls}>{errors.cpf.message}</p> : null}
                          </div>
                          <div>
                            <label className={labelCls} htmlFor="colab-cnpj">
                              CNPJ
                            </label>
                            <Controller
                              name="cnpj"
                              control={control}
                              render={({ field }) => (
                                <input
                                  id="colab-cnpj"
                                  name={field.name}
                                  inputMode="numeric"
                                  value={field.value ?? ""}
                                  onChange={(e) => field.onChange(formatCnpj(e.target.value))}
                                  onBlur={field.onBlur}
                                  ref={field.ref}
                                  className={errors.cnpj ? inputErrCls : inputCls}
                                  placeholder="00.000.000/0000-00"
                                />
                              )}
                            />
                            {errors.cnpj ? <p className={errorCls}>{errors.cnpj.message}</p> : null}
                          </div>
                        </div>
                        <div className="px-[14px] pb-[14px]">
                          <label className={labelCls} htmlFor="colab-razao">
                            Razão social <span className="text-[#E24B4A]">*</span>
                          </label>
                          <input
                            id="colab-razao"
                            {...register("razaoSocial")}
                            className={errors.razaoSocial ? inputErrCls : inputCls}
                            placeholder="Ex: Audio House LTDA"
                          />
                          {errors.razaoSocial ? (
                            <p className={errorCls}>{errors.razaoSocial.message}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-[10px] border border-[#252525] bg-[#1a1a1a]">
                        <div className="border-b border-[#252525] px-[14px] py-[10px]">
                          <span className="text-[12px] font-[600] text-[#e8e8e8]">Contato</span>
                        </div>
                        <div className="grid grid-cols-2 gap-[10px] p-[14px]">
                          <div>
                            <label className={labelCls} htmlFor="colab-email">
                              E-mail
                            </label>
                            <input
                              id="colab-email"
                              type="email"
                              {...register("email")}
                              onInvalid={(e) => e.preventDefault()}
                              className={errors.email ? inputErrCls : inputCls}
                              placeholder="colaborador@email.com"
                            />
                            {errors.email ? <p className={errorCls}>{errors.email.message}</p> : null}
                          </div>
                          <div>
                            <label className={labelCls} htmlFor="colab-wa">
                              WhatsApp
                            </label>
                            <Controller
                              name="whatsapp"
                              control={control}
                              render={({ field }) => (
                                <input
                                  id="colab-wa"
                                  name={field.name}
                                  type="tel"
                                  inputMode="numeric"
                                  value={field.value ?? ""}
                                  onChange={(e) =>
                                    field.onChange(formatBrazilPhone(e.target.value))
                                  }
                                  onBlur={field.onBlur}
                                  ref={field.ref}
                                  className={errors.whatsapp ? inputErrCls : inputCls}
                                  placeholder="(11) 99999-0000"
                                />
                              )}
                            />
                            {errors.whatsapp ? (
                              <p className={errorCls}>{errors.whatsapp.message}</p>
                            ) : null}
                          </div>
                        </div>
                        <div className="px-[14px] pb-[14px]">
                          <label className={labelCls}>Canais ativos para comunicação</label>
                          <div className="flex flex-wrap items-center gap-[6px] rounded-[6px] border border-[#2e2e2e] bg-[#111] px-[10px] py-[8px]">
                            <CommunicationPreferenceChannelToggle
                              channel="EMAIL"
                              active={prefersEmail}
                              disabled={isSubmitting}
                              onToggle={() =>
                                setValue("prefersEmail", !prefersEmail, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                })
                              }
                            />
                            <CommunicationPreferenceChannelToggle
                              channel="WHATSAPP"
                              active={prefersWhatsapp}
                              disabled={isSubmitting}
                              onToggle={() =>
                                setValue("prefersWhatsapp", !prefersWhatsapp, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                })
                              }
                            />
                          </div>
                          {errors.prefersEmail ? (
                            <p className={errorCls}>{errors.prefersEmail.message}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {activeTab === "info" && (
              <div className="flex shrink-0 items-center gap-[8px] border-t border-[#1e1e1e] bg-[#141414] px-[24px] py-[10px]">
                <div className="flex-1" />
                {savedMsg ? (
                  <span className="text-[11px] text-[#5DCAA5]">✓ Salvo com sucesso</span>
                ) : null}
                {isDirty && !savedMsg ? (
                  <span className="text-[11px] text-[#EF9F27]">● Alterações não salvas</span>
                ) : null}
                <button
                  type="button"
                  onClick={() => reset(getDefaults(collaborator))}
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
            )}
          </div>
        </form>
      </div>
    </PageShell>
  );
}
