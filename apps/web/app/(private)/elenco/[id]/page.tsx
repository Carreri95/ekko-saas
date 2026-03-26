"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageShell } from "@/app/components/page-shell";
import { useConfirm } from "@/app/components/confirm-provider";
import {
  formatBrazilPhone,
  normalizePhoneForStorage,
} from "@/src/lib/phone-format";
import {
  castMemberFormSchema,
  type CastMemberFormData,
  type CastMemberFormInput,
} from "../schemas";
import type {
  CastMemberCastingDto,
  CastMemberDto,
} from "@/app/types/cast-member";
import "../../projetos/projetos.css";

const TABS = [
  { id: "info", label: "Informações", enabled: true },
  { id: "projetos", label: "Projetos", enabled: true },
  { id: "agenda", label: "Agenda", enabled: false },
] as const;
type TabId = (typeof TABS)[number]["id"];

const inputCls =
  "w-full min-h-[36px] rounded-[6px] border border-[#2e2e2e] bg-[#111] px-[10px] py-[7px] text-[13px] text-[#e8e8e8] outline-none placeholder:text-[#505050] focus:border-[#1D9E75] transition-colors";
const inputErrCls =
  "w-full min-h-[36px] rounded-[6px] border border-[#E24B4A] bg-[#111] px-[10px] py-[7px] text-[13px] text-[#e8e8e8] outline-none focus:border-[#E24B4A] transition-colors";
const labelCls =
  "mb-[5px] block text-[10px] font-[600] uppercase tracking-[0.07em] text-[#505050]";
const errorCls = "mt-[3px] text-[11px] text-[#F09595]";

function importanceLabel(i: CastMemberCastingDto["importance"]) {
  if (i === "MAIN") return "Principal";
  if (i === "SUPPORT") return "Suporte";
  return "Figurante";
}

function getDefaults(m: CastMemberDto): CastMemberFormInput {
  return {
    name: m.name,
    role: m.role ?? "",
    whatsapp: formatBrazilPhone(m.whatsapp ?? ""),
    email: m.email ?? "",
    specialties: m.specialties ?? [],
    manualInactive: m.status === "INACTIVE",
    notes: m.notes ?? "",
  };
}

function SpecialtiesInput({
  value,
  onChange,
  error,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  error: boolean;
}) {
  const [input, setInput] = useState("");
  const add = () => {
    const t = input.trim();
    if (!t || value.includes(t) || value.length >= 10) return;
    onChange([...value, t]);
    setInput("");
  };
  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));
  return (
    <div className="flex flex-col gap-[6px]">
      <div
        className={`flex gap-[6px] ${error ? "rounded-[6px] ring-1 ring-[#E24B4A]" : ""}`}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          className={inputCls}
          placeholder="Ex: Feminino adulto"
        />
        <button
          type="button"
          onClick={add}
          className="flex-shrink-0 rounded-[5px] border border-[#2e2e2e] bg-[#252525] px-[10px] text-[11px] text-[#909090] transition-colors hover:bg-[#2a2a2a] hover:text-[#e8e8e8]"
        >
          + Add
        </button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-[4px]">
          {value.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-[4px] rounded-[4px] bg-[#252525] px-[7px] py-[2px] text-[11px] text-[#909090]"
            >
              {tag}
              <button
                type="button"
                onClick={() => remove(tag)}
                className="leading-none text-[#505050] transition-colors hover:text-[#F09595]"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CastMemberEditPage() {
  const params = useParams();
  const router = useRouter();
  const confirm = useConfirm();
  const id = typeof params.id === "string" ? params.id : "";

  const [member, setMember] = useState<CastMemberDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("info");
  const [savedMsg, setSavedMsg] = useState(false);
  const [castings, setCastings] = useState<CastMemberCastingDto[]>([]);
  const [castingsLoading, setCastingsLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    setLoading(true);
    setNotFound(false);
    try {
      const res = await fetch(`/api/cast-members/${id}`);
      if (!res.ok) {
        setNotFound(true);
        setMember(null);
        return;
      }
      const data = (await res.json()) as { member: CastMemberDto };
      setMember(data.member);
    } catch {
      setNotFound(true);
      setMember(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (activeTab !== "projetos" || !id) return;
    let cancelled = false;
    setCastingsLoading(true);
    void (async () => {
      try {
        const res = await fetch(`/api/cast-members/${id}/castings`);
        if (!res.ok) return;
        const data = (await res.json()) as { castings: CastMemberCastingDto[] };
        if (!cancelled) setCastings(data.castings ?? []);
      } finally {
        if (!cancelled) setCastingsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTab, id]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<CastMemberFormInput, unknown, CastMemberFormData>({
    resolver: zodResolver(castMemberFormSchema) as Resolver<
      CastMemberFormInput,
      unknown,
      CastMemberFormData
    >,
    mode: "all",
  });

  useEffect(() => {
    if (member) {
      reset(getDefaults(member));
      clearErrors();
    }
  }, [member, reset, clearErrors]);

  const onSubmit = async (data: CastMemberFormData) => {
    clearErrors("root");
    const res = await fetch(`/api/cast-members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name.trim(),
        role: data.role.trim(),
        whatsapp: normalizePhoneForStorage(data.whatsapp) ?? "",
        email: data.email.trim(),
        specialties: data.specialties,
        manualInactive: data.manualInactive,
        notes: data.notes?.trim() ?? "",
      }),
    });

    if (res.status === 409) {
      const conflict = (await res.json()) as {
        error: string;
        field: string | null;
      };
      if (conflict.field === "email") {
        setError("email", { message: conflict.error });
      } else if (conflict.field === "whatsapp") {
        setError("whatsapp", { message: conflict.error });
      } else {
        setError("root", { message: conflict.error });
      }
      return;
    }

    if (!res.ok) {
      setError("root", { message: "Erro ao salvar. Tente novamente." });
      return;
    }
    const updated = (await res.json()) as { member: CastMemberDto };
    setMember(updated.member);
    reset(getDefaults(updated.member));
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 3000);
  };

  const handleDelete = async () => {
    if (!member) return;
    const ok = await confirm({
      title: "Remover dublador",
      description: `Confirma remover "${member.name}" do elenco? Esta ação não pode ser desfeita.`,
      variant: "danger",
      confirmLabel: "Sim, remover",
      cancelLabel: "Não",
    });
    if (!ok) return;
    const res = await fetch(`/api/cast-members/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/elenco");
  };

  if (loading) {
    return (
      <PageShell title="Carregando…" section="gestao">
        <div className="flex h-full min-h-[200px] items-center justify-center text-[13px] text-[#505050]">
          Carregando dublador…
        </div>
      </PageShell>
    );
  }

  if (notFound || !member) {
    return (
      <PageShell title="Não encontrado" section="gestao">
        <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-4">
          <p className="text-[13px] text-[#505050]">
            Este dublador não existe ou foi removido.
          </p>
          <button
            type="button"
            onClick={() => router.push("/elenco")}
            className="rounded-[6px] border border-[#2e2e2e] bg-[#252525] px-[14px] py-[6px] text-[12px] text-[#909090] hover:bg-[#2a2a2a]"
          >
            ← Voltar ao elenco
          </button>
        </div>
      </PageShell>
    );
  }

  const statusSubtitle =
    member.status === "BUSY"
      ? "Em projeto"
      : member.status === "INACTIVE"
        ? "Inativo"
        : "Disponível";

  return (
    <PageShell
      title={member.name}
      section="gestao"
      subtitle={`· ${statusSubtitle}`}
      noScroll
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center gap-[6px] border-b border-[#1e1e1e] bg-[#141414] px-[24px] py-[7px] text-[11px]">
          <button
            type="button"
            onClick={() => router.push("/elenco")}
            className="text-[#505050] transition-colors hover:text-[#909090]"
          >
            ← Elenco
          </button>
          <span className="text-[#2e2e2e]">/</span>
          <span className="max-w-[min(100%,300px)] truncate text-[#909090]">
            {member.name}
          </span>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex min-h-0 flex-1 flex-row"
        >
          <aside className="flex w-[200px] shrink-0 flex-col border-r border-[#1e1e1e] bg-[#141414] px-[8px] py-[12px]">
            <div className="mb-[4px] px-[8px] text-[9px] font-[700] uppercase tracking-[0.1em] text-[#333]">
              Este dublador
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
              <div className="mb-[4px] px-[8px] text-[9px] font-[700] uppercase tracking-[0.1em] text-[#333]">
                Perigo
              </div>
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
                Remover dublador
              </button>
            </div>
          </aside>

          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-[20px] py-[20px] sm:px-[28px] sm:py-[24px]">
              {activeTab === "info" && (
                <div className="flex flex-col gap-[14px]">
                  {errors.root && (
                    <div className="rounded-[5px] border border-[#5a1515] bg-[#2a0a0a] px-[10px] py-[8px] text-[11px] text-[#F09595]">
                      {errors.root.message}
                    </div>
                  )}

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
                            <label className={labelCls} htmlFor="edit-name">
                              Nome completo{" "}
                              <span className="text-[#E24B4A]">*</span>
                            </label>
                            <input
                              id="edit-name"
                              {...register("name")}
                              onInvalid={(e) => e.preventDefault()}
                              className={errors.name ? inputErrCls : inputCls}
                              placeholder="Ex: Maria Silva"
                            />
                            {errors.name && (
                              <p className={errorCls}>{errors.name.message}</p>
                            )}
                          </div>
                          <div>
                            <label className={labelCls} htmlFor="edit-role">
                              Função / Cargo{" "}
                              <span className="text-[#E24B4A]">*</span>
                            </label>
                            <input
                              id="edit-role"
                              {...register("role")}
                              className={errors.role ? inputErrCls : inputCls}
                              placeholder="Ex: Dubladora sênior"
                            />
                            {errors.role && (
                              <p className={errorCls}>{errors.role.message}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-[10px] border border-[#252525] bg-[#1a1a1a]">
                        <div className="border-b border-[#252525] px-[14px] py-[10px]">
                          <span className="text-[12px] font-[600] text-[#e8e8e8]">
                            Contato
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-[10px] p-[14px]">
                          <div>
                            <label
                              className={labelCls}
                              htmlFor="edit-whatsapp"
                            >
                              WhatsApp{" "}
                              <span className="text-[#E24B4A]">*</span>
                            </label>
                            <Controller
                              name="whatsapp"
                              control={control}
                              render={({ field }) => (
                                <input
                                  id="edit-whatsapp"
                                  name={field.name}
                                  type="tel"
                                  inputMode="numeric"
                                  value={field.value ?? ""}
                                  onChange={(e) =>
                                    field.onChange(
                                      formatBrazilPhone(e.target.value),
                                    )
                                  }
                                  onBlur={field.onBlur}
                                  ref={field.ref}
                                  className={
                                    errors.whatsapp ? inputErrCls : inputCls
                                  }
                                  placeholder="(11) 99999-0000"
                                />
                              )}
                            />
                            {errors.whatsapp && (
                              <p className={errorCls}>
                                {errors.whatsapp.message}
                              </p>
                            )}
                          </div>
                          <div>
                            <label className={labelCls} htmlFor="edit-email">
                              E-mail{" "}
                              <span className="text-[#E24B4A]">*</span>
                            </label>
                            <input
                              id="edit-email"
                              type="email"
                              {...register("email")}
                              onInvalid={(e) => e.preventDefault()}
                              className={errors.email ? inputErrCls : inputCls}
                              placeholder="dublador@email.com"
                            />
                            {errors.email && (
                              <p className={errorCls}>{errors.email.message}</p>
                            )}
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
                            rows={4}
                            maxLength={2000}
                            className={`${errors.notes ? inputErrCls : inputCls} min-h-[90px] resize-none`}
                            placeholder="Notas internas sobre este dublador..."
                          />
                          {errors.notes && (
                            <p className={errorCls}>{errors.notes.message}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="project-edit-col-side">
                      <div className="overflow-hidden rounded-[10px] border border-[#252525] bg-[#1a1a1a]">
                        <div className="border-b border-[#252525] px-[14px] py-[10px]">
                          <span className="text-[12px] font-[600] text-[#e8e8e8]">
                            Status
                          </span>
                        </div>
                        <div className="flex flex-col gap-[6px] p-[14px]">
                          <div
                            className="rounded-[6px] border px-[12px] py-[8px] text-[12px] font-[500]"
                            style={
                              member.status === "BUSY"
                                ? {
                                    background: "rgba(186,117,23,0.1)",
                                    borderColor: "#BA7517",
                                    color: "#EF9F27",
                                  }
                                : member.status === "INACTIVE"
                                  ? {
                                      background: "#1e1e1e",
                                      borderColor: "#2e2e2e",
                                      color: "#505050",
                                    }
                                  : {
                                      background: "rgba(29,158,117,0.1)",
                                      borderColor: "#1D9E75",
                                      color: "#5DCAA5",
                                    }
                            }
                          >
                            <div className="flex items-center gap-[6px]">
                              <span
                                className="h-[6px] w-[6px] flex-shrink-0 rounded-full"
                                style={{
                                  background:
                                    member.status === "BUSY"
                                      ? "#BA7517"
                                      : member.status === "INACTIVE"
                                        ? "#444"
                                        : "#1D9E75",
                                }}
                              />
                              {member.status === "BUSY"
                                ? "Em projeto"
                                : member.status === "INACTIVE"
                                  ? "Inativo"
                                  : "Disponível"}
                            </div>
                            {member.status !== "INACTIVE" ? (
                              <div className="mt-[2px] text-[10px] opacity-60">
                                Atualizado automaticamente com base nos projetos
                              </div>
                            ) : null}
                          </div>

                          <Controller
                            name="manualInactive"
                            control={control}
                            render={({ field }) => (
                              <button
                                type="button"
                                onClick={() =>
                                  field.onChange(!field.value)
                                }
                                className="rounded-[6px] border px-[12px] py-[7px] text-left text-[11px] font-[500] transition-colors"
                                style={
                                  field.value
                                    ? {
                                        background: "#1e1e1e",
                                        borderColor: "#2e2e2e",
                                        color: "#909090",
                                      }
                                    : {
                                        background: "transparent",
                                        borderColor: "#2e2e2e",
                                        color: "#505050",
                                      }
                                }
                              >
                                {field.value
                                  ? "✓ Marcado como inativo — clique para reativar"
                                  : "Marcar como inativo"}
                              </button>
                            )}
                          />
                          <p className="text-[10px] text-[#404040]">
                            Inativo = dublador fora do estúdio. Não aparece em
                            novos projetos.
                          </p>
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-[10px] border border-[#252525] bg-[#1a1a1a]">
                        <div className="border-b border-[#252525] px-[14px] py-[10px]">
                          <span className="text-[12px] font-[600] text-[#e8e8e8]">
                            Especialidades{" "}
                            <span className="text-[#E24B4A]">*</span>
                          </span>
                        </div>
                        <div className="p-[14px]">
                          <Controller
                            name="specialties"
                            control={control}
                            render={({ field }) => (
                              <SpecialtiesInput
                                value={field.value ?? []}
                                onChange={field.onChange}
                                error={!!errors.specialties}
                              />
                            )}
                          />
                          <p className="mt-[6px] text-[10px] text-[#444]">
                            Digite e pressione Enter para adicionar.
                          </p>
                          {errors.specialties && (
                            <p className={errorCls}>
                              {typeof errors.specialties === "object" &&
                              "message" in errors.specialties
                                ? String(errors.specialties.message)
                                : "Adicione pelo menos uma especialidade"}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "projetos" && (
                <div className="flex flex-col gap-[16px]">
                  {castingsLoading ? (
                    <div className="py-[24px] text-center text-[12px] text-[#505050]">
                      A carregar…
                    </div>
                  ) : (
                    <>
                      <div>
                        <h3 className="mb-[8px] text-[11px] font-[600] uppercase tracking-[0.06em] text-[#505050]">
                          Projetos ativos
                        </h3>
                        {castings.filter((c) => c.isActive).length === 0 ? (
                          <div className="rounded-[8px] border border-[#252525] bg-[#1a1a1a] px-[14px] py-[20px] text-center text-[12px] text-[#444]">
                            Nenhum projeto ativo no momento
                          </div>
                        ) : (
                          <div className="overflow-hidden rounded-[8px] border border-[#252525] bg-[#1a1a1a]">
                            <table className="projects-table w-full">
                              <colgroup>
                                <col />
                                <col style={{ width: 200 }} />
                                <col style={{ width: 120 }} />
                                <col style={{ width: 90 }} />
                              </colgroup>
                              <thead>
                                <tr>
                                  <th>Personagem</th>
                                  <th>Projeto</th>
                                  <th>Cliente</th>
                                  <th>Importância</th>
                                </tr>
                              </thead>
                              <tbody>
                                {castings
                                  .filter((c) => c.isActive)
                                  .map((c) => (
                                    <tr
                                      key={c.characterId}
                                      className="cursor-pointer transition-colors hover:bg-[#202020]"
                                      onClick={() =>
                                        router.push(`/projetos/${c.projectId}`)
                                      }
                                    >
                                      <td>
                                        <div className="text-[13px] font-[500] text-[#e8e8e8]">
                                          {c.characterName}
                                        </div>
                                        {c.voiceType ? (
                                          <div className="text-[10px] text-[#505050]">
                                            {c.voiceType}
                                          </div>
                                        ) : null}
                                      </td>
                                      <td className="text-[12px] text-[#909090]">
                                        {c.projectName}
                                      </td>
                                      <td className="text-[11px] text-[#606060]">
                                        {c.projectClient ?? "—"}
                                      </td>
                                      <td>
                                        <span className="rounded-[3px] bg-[#252525] px-[6px] py-[1px] text-[10px] text-[#707070]">
                                          {importanceLabel(c.importance)}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      {castings.filter((c) => !c.isActive).length > 0 ? (
                        <div>
                          <h3 className="mb-[8px] text-[11px] font-[600] uppercase tracking-[0.06em] text-[#505050]">
                            Histórico
                          </h3>
                          <div className="overflow-hidden rounded-[8px] border border-[#252525] bg-[#1a1a1a] opacity-70">
                            <table className="projects-table w-full">
                              <colgroup>
                                <col />
                                <col style={{ width: 200 }} />
                                <col style={{ width: 120 }} />
                                <col style={{ width: 90 }} />
                              </colgroup>
                              <thead>
                                <tr>
                                  <th>Personagem</th>
                                  <th>Projeto</th>
                                  <th>Cliente</th>
                                  <th>Importância</th>
                                </tr>
                              </thead>
                              <tbody>
                                {castings
                                  .filter((c) => !c.isActive)
                                  .map((c) => (
                                    <tr
                                      key={c.characterId}
                                      className="cursor-pointer transition-colors hover:bg-[#202020]"
                                      onClick={() =>
                                        router.push(`/projetos/${c.projectId}`)
                                      }
                                    >
                                      <td>
                                        <div className="text-[13px] font-[500] text-[#909090]">
                                          {c.characterName}
                                        </div>
                                        {c.voiceType ? (
                                          <div className="text-[10px] text-[#444]">
                                            {c.voiceType}
                                          </div>
                                        ) : null}
                                      </td>
                                      <td className="text-[12px] text-[#606060]">
                                        {c.projectName}
                                      </td>
                                      <td className="text-[11px] text-[#505050]">
                                        {c.projectClient ?? "—"}
                                      </td>
                                      <td>
                                        <span className="rounded-[3px] bg-[#1e1e1e] px-[6px] py-[1px] text-[10px] text-[#505050]">
                                          {importanceLabel(c.importance)}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              )}

              {activeTab === "agenda" && (
                <div className="flex min-h-[200px] items-center justify-center rounded-[10px] border border-[#252525] bg-[#1a1a1a] text-[13px] text-[#444]">
                  Em breve
                </div>
              )}
            </div>

            {activeTab === "info" && (
              <div className="flex shrink-0 items-center gap-[8px] border-t border-[#1e1e1e] bg-[#141414] px-[24px] py-[10px]">
                <div className="flex-1" />
                {savedMsg && (
                  <span className="text-[11px] text-[#5DCAA5]">
                    ✓ Salvo com sucesso
                  </span>
                )}
                {isDirty && !savedMsg && (
                  <span className="text-[11px] text-[#EF9F27]">
                    ● Alterações não salvas
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => reset(getDefaults(member))}
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
