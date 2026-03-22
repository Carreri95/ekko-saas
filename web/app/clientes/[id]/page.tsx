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
  clientFormSchema,
  type ClientFormData,
  type ClientFormInput,
} from "../schemas";
import type { ClientDto } from "@/app/types/client";
import "../../projetos/projetos.css";

const TABS = [
  { id: "info", label: "Informações", enabled: true },
  { id: "projetos", label: "Projetos", enabled: false },
  { id: "historico", label: "Histórico", enabled: false },
] as const;
type TabId = (typeof TABS)[number]["id"];

const STATUS_OPTIONS = [
  { value: "ACTIVE" as const, label: "Ativo", color: "#1D9E75" },
  { value: "INACTIVE" as const, label: "Inativo", color: "#555" },
] as const;

const inputCls =
  "w-full min-h-[36px] rounded-[6px] border border-[#2e2e2e] bg-[#111] px-[10px] py-[7px] text-[13px] text-[#e8e8e8] outline-none placeholder:text-[#505050] focus:border-[#1D9E75] transition-colors";
const inputErrCls =
  "w-full min-h-[36px] rounded-[6px] border border-[#E24B4A] bg-[#111] px-[10px] py-[7px] text-[13px] text-[#e8e8e8] outline-none focus:border-[#E24B4A] transition-colors";
const labelCls =
  "mb-[5px] block text-[10px] font-[600] uppercase tracking-[0.07em] text-[#505050]";
const errorCls = "mt-[3px] text-[11px] text-[#F09595]";

function getDefaults(c: ClientDto): ClientFormInput {
  return {
    name: c.name,
    email: c.email ?? "",
    phone: formatBrazilPhone(c.phone ?? ""),
    country: c.country ?? "",
    notes: c.notes ?? "",
    status: c.status,
  };
}

export default function ClientEditPage() {
  const params = useParams();
  const router = useRouter();
  const confirm = useConfirm();
  const id = typeof params.id === "string" ? params.id : "";

  const [client, setClient] = useState<ClientDto | null>(null);
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
      const res = await fetch(`/api/clients/${id}`);
      if (!res.ok) {
        setNotFound(true);
        setClient(null);
        return;
      }
      const data = (await res.json()) as { client: ClientDto };
      setClient(data.client);
    } catch {
      setNotFound(true);
      setClient(null);
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
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ClientFormInput, unknown, ClientFormData>({
    resolver: zodResolver(clientFormSchema) as Resolver<
      ClientFormInput,
      unknown,
      ClientFormData
    >,
    mode: "all",
  });

  useEffect(() => {
    if (client) {
      reset(getDefaults(client));
      clearErrors();
    }
  }, [client, reset, clearErrors]);

  const onSubmit = async (data: ClientFormData) => {
    clearErrors("root");
    const res = await fetch(`/api/clients/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name.trim(),
        email: data.email.trim(),
        phone: normalizePhoneForStorage(data.phone) ?? "",
        country: data.country?.trim() ?? "",
        notes: data.notes?.trim() ?? "",
        status: data.status,
      }),
    });

    if (res.status === 409) {
      const conflict = (await res.json()) as {
        error: string;
        field: string | null;
      };
      if (conflict.field === "email") {
        setError("email", { message: conflict.error });
      } else if (conflict.field === "phone") {
        setError("phone", { message: conflict.error });
      } else {
        setError("root", { message: conflict.error });
      }
      return;
    }

    if (!res.ok) {
      setError("root", { message: "Erro ao salvar. Tente novamente." });
      return;
    }
    const updated = (await res.json()) as { client: ClientDto };
    setClient(updated.client);
    reset(getDefaults(updated.client));
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 3000);
  };

  const handleDelete = async () => {
    if (!client) return;
    const ok = await confirm({
      title: "Remover cliente",
      description: `Confirma remover "${client.name}"? Esta ação não pode ser desfeita.`,
      variant: "danger",
      confirmLabel: "Sim, remover",
      cancelLabel: "Não",
    });
    if (!ok) return;
    const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/clientes");
  };

  if (loading) {
    return (
      <PageShell title="Carregando…" section="gestao">
        <div className="flex h-full min-h-[200px] items-center justify-center text-[13px] text-[#505050]">
          Carregando cliente…
        </div>
      </PageShell>
    );
  }

  if (notFound || !client) {
    return (
      <PageShell title="Não encontrado" section="gestao">
        <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-4">
          <p className="text-[13px] text-[#505050]">
            Este cliente não existe ou foi removido.
          </p>
          <button
            type="button"
            onClick={() => router.push("/clientes")}
            className="rounded-[6px] border border-[#2e2e2e] bg-[#252525] px-[14px] py-[6px] text-[12px] text-[#909090] hover:bg-[#2a2a2a]"
          >
            ← Voltar aos clientes
          </button>
        </div>
      </PageShell>
    );
  }

  const statusSubtitle =
    STATUS_OPTIONS.find((s) => s.value === client.status)?.label ??
    String(client.status);

  return (
    <PageShell
      title={client.name}
      section="gestao"
      subtitle={`· ${statusSubtitle}`}
      noScroll
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex shrink-0 items-center gap-[6px] border-b border-[#1e1e1e] bg-[#141414] px-[24px] py-[7px] text-[11px]">
          <button
            type="button"
            onClick={() => router.push("/clientes")}
            className="text-[#505050] transition-colors hover:text-[#909090]"
          >
            ← Clientes
          </button>
          <span className="text-[#2e2e2e]">/</span>
          <span className="max-w-[min(100%,300px)] truncate text-[#909090]">
            {client.name}
          </span>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex min-h-0 flex-1 flex-row"
        >
          <aside className="flex w-[200px] shrink-0 flex-col border-r border-[#1e1e1e] bg-[#141414] px-[8px] py-[12px]">
            <div className="mb-[4px] px-[8px] text-[9px] font-[700] uppercase tracking-[0.1em] text-[#333]">
              Este cliente
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
                Remover cliente
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
                            <label className={labelCls} htmlFor="edit-name">
                              Nome <span className="text-[#E24B4A]">*</span>
                            </label>
                            <input
                              id="edit-name"
                              {...register("name")}
                              onInvalid={(e) => e.preventDefault()}
                              className={errors.name ? inputErrCls : inputCls}
                              placeholder="Nome do cliente"
                            />
                            {errors.name ? (
                              <p className={errorCls}>{errors.name.message}</p>
                            ) : null}
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
                              htmlFor="edit-email"
                            >
                              E-mail
                            </label>
                            <input
                              id="edit-email"
                              type="email"
                              {...register("email")}
                              onInvalid={(e) => e.preventDefault()}
                              className={errors.email ? inputErrCls : inputCls}
                              placeholder="contato@email.com"
                            />
                            {errors.email ? (
                              <p className={errorCls}>{errors.email.message}</p>
                            ) : null}
                          </div>
                          <div>
                            <label
                              className={labelCls}
                              htmlFor="edit-phone"
                            >
                              Telefone
                            </label>
                            <Controller
                              name="phone"
                              control={control}
                              render={({ field }) => (
                                <input
                                  id="edit-phone"
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
                                    errors.phone ? inputErrCls : inputCls
                                  }
                                  placeholder="(11) 3000-0000"
                                />
                              )}
                            />
                            {errors.phone ? (
                              <p className={errorCls}>{errors.phone.message}</p>
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
                            rows={4}
                            maxLength={2000}
                            className={`${errors.notes ? inputErrCls : inputCls} min-h-[90px] resize-none`}
                            placeholder="Notas internas…"
                          />
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
                            Status
                          </span>
                        </div>
                        <div className="flex flex-col gap-[6px] p-[14px]">
                          <Controller
                            name="status"
                            control={control}
                            render={({ field }) => (
                              <>
                                {STATUS_OPTIONS.map((s) => (
                                  <button
                                    key={s.value}
                                    type="button"
                                    onClick={() => field.onChange(s.value)}
                                    className="flex items-center gap-[8px] rounded-[6px] border px-[12px] py-[8px] text-left text-[12px] font-[500] transition-colors"
                                    style={
                                      field.value === s.value
                                        ? {
                                            background: `${s.color}18`,
                                            borderColor: s.color,
                                            color: s.color,
                                          }
                                        : {
                                            background: "transparent",
                                            borderColor: "#2e2e2e",
                                            color: "#606060",
                                          }
                                    }
                                  >
                                    <span
                                      className="h-[6px] w-[6px] flex-shrink-0 rounded-full"
                                      style={{
                                        background:
                                          field.value === s.value
                                            ? s.color
                                            : "#333",
                                      }}
                                    />
                                    {s.label}
                                  </button>
                                ))}
                              </>
                            )}
                          />
                        </div>
                      </div>

                      <div className="overflow-hidden rounded-[10px] border border-[#252525] bg-[#1a1a1a]">
                        <div className="border-b border-[#252525] px-[14px] py-[10px]">
                          <span className="text-[12px] font-[600] text-[#e8e8e8]">
                            País / origem
                          </span>
                        </div>
                        <div className="p-[14px]">
                          <input
                            {...register("country")}
                            className={errors.country ? inputErrCls : inputCls}
                            placeholder="Ex: Brasil"
                          />
                          {errors.country ? (
                            <p className={errorCls}>{errors.country.message}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab !== "info" && (
                <div className="flex min-h-[200px] items-center justify-center rounded-[10px] border border-[#252525] bg-[#1a1a1a] text-[13px] text-[#444]">
                  Em breve
                </div>
              )}
            </div>

            {activeTab === "info" && (
              <div className="flex shrink-0 items-center gap-[8px] border-t border-[#1e1e1e] bg-[#141414] px-[24px] py-[10px]">
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
                  onClick={() => reset(getDefaults(client))}
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
