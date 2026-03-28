"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import {
  collaboratorFormSchema,
  type CollaboratorFormData,
  type CollaboratorFormInput,
} from "../schemas";
import { COLLABORATOR_ROLE_LABEL } from "../role-labels";
import type { CollaboratorDto, CollaboratorRole } from "@/app/types/collaborator";
import { CommunicationPreferenceChannelToggle } from "@/app/components/communication-channel-chip";
import { useConfirm } from "@/app/components/confirm-provider";
import { formatBrazilPhone, normalizePhoneForStorage } from "@/src/lib/phone-format";
import { formatCnpj, formatCpf } from "@/src/lib/document-format";

const inputValidCls = `
  w-full min-h-[36px] rounded-[6px] border border-[#2e2e2e] bg-[#111]
  px-[10px] py-[8px] text-[13px] leading-snug text-[#e8e8e8] outline-none
  placeholder:text-[#505050]
  focus:border-[#1D9E75] focus:ring-0
  transition-colors
`.trim();

const inputErrorCls = `
  w-full min-h-[36px] rounded-[6px] border border-[#E24B4A] bg-[#111]
  px-[10px] py-[8px] text-[13px] leading-snug text-[#e8e8e8] outline-none
  focus:border-[#E24B4A] focus:ring-0
  transition-colors
`.trim();

const labelCls =
  "mb-[5px] block text-[10px] font-[600] uppercase tracking-[0.07em] text-[#505050]";
const errorCls = "mt-[3px] text-[11px] text-[#F09595]";

function getDefaults(c: CollaboratorDto | null): CollaboratorFormInput {
  if (!c) {
    return {
      name: "",
      cpf: "",
      cnpj: "",
      razaoSocial: "",
      role: "RECORDING_TECHNICIAN",
      email: "",
      whatsapp: "",
      prefersEmail: true,
      prefersWhatsapp: false,
    };
  }
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

type Props = {
  collaborator: CollaboratorDto | null;
  onClose: () => void;
  onSaved: () => void;
};

export function CollaboratorDrawer({ collaborator, onClose, onSaved }: Props) {
  const confirm = useConfirm();
  const isNew = collaborator == null;

  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    clearErrors,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CollaboratorFormInput>({
    resolver: zodResolver(collaboratorFormSchema),
    defaultValues: getDefaults(collaborator),
    mode: "all",
  });

  useEffect(() => {
    reset(getDefaults(collaborator));
    clearErrors();
  }, [collaborator, reset, clearErrors]);

  const prefersEmail = watch("prefersEmail");
  const prefersWhatsapp = watch("prefersWhatsapp");

  const onSubmit = async (data: CollaboratorFormData) => {
    clearErrors("root");
    const url = isNew ? "/api/collaborators" : `/api/collaborators/${collaborator!.id}`;
    const method = isNew ? "POST" : "PATCH";
    try {
      const res = await fetch(url, {
        method,
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

      if (!res.ok) throw new Error(await res.text());
      onSaved();
    } catch {
      setError("root", { message: "Erro ao salvar. Tente novamente." });
    }
  };

  const handleDelete = async () => {
    if (!collaborator) return;
    const ok = await confirm({
      title: "Remover colaborador",
      description: `Confirma remover "${collaborator.name}"? Esta ação não pode ser desfeita.`,
      variant: "danger",
      confirmLabel: "Sim, remover",
    });
    if (!ok) return;
    const res = await fetch(`/api/collaborators/${collaborator.id}`, { method: "DELETE" });
    if (res.ok) onSaved();
    else setError("root", { message: "Erro ao excluir." });
  };

  return (
    <>
      <button type="button" className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="fixed right-0 top-0 z-50 flex h-full w-[min(100vw,420px)] flex-col border-l border-[#2e2e2e] bg-[#1a1a1a] shadow-2xl"
      >
        <div className="flex h-[48px] shrink-0 items-center justify-between border-b border-[#2e2e2e] px-[18px]">
          <span className="text-[14px] font-[600] text-[#e8e8e8]">
            {isNew ? "Novo colaborador" : "Editar colaborador"}
          </span>
          <button type="button" onClick={onClose} className="text-[#505050] hover:text-[#e8e8e8]">
            ×
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto px-[18px] py-[16px]">
          {errors.root ? (
            <div className="rounded-[5px] border border-[#5a1515] bg-[#2a0a0a] px-[10px] py-[8px] text-[11px] text-[#F09595]">
              {errors.root.message}
            </div>
          ) : null}

          <div>
            <label className={labelCls}>Nome completo</label>
            <input
              {...register("name")}
              className={errors.name ? inputErrorCls : inputValidCls}
              placeholder="Ex: Ana Souza"
            />
            {errors.name ? <p className={errorCls}>{errors.name.message}</p> : null}
          </div>

          <div>
            <label className={labelCls}>Função</label>
            <select {...register("role")} className={errors.role ? inputErrorCls : inputValidCls}>
              {(Object.keys(COLLABORATOR_ROLE_LABEL) as CollaboratorRole[]).map((role) => (
                <option key={role} value={role}>
                  {COLLABORATOR_ROLE_LABEL[role]}
                </option>
              ))}
            </select>
            {errors.role ? <p className={errorCls}>{errors.role.message}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-[10px]">
            <div>
              <label className={labelCls}>CPF</label>
              <Controller
                name="cpf"
                control={control}
                render={({ field }) => (
                  <input
                    name={field.name}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(formatCpf(e.target.value))}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    className={errors.cpf ? inputErrorCls : inputValidCls}
                    placeholder="000.000.000-00"
                  />
                )}
              />
              {errors.cpf ? <p className={errorCls}>{errors.cpf.message}</p> : null}
            </div>
            <div>
              <label className={labelCls}>CNPJ</label>
              <Controller
                name="cnpj"
                control={control}
                render={({ field }) => (
                  <input
                    name={field.name}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(formatCnpj(e.target.value))}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    className={errors.cnpj ? inputErrorCls : inputValidCls}
                    placeholder="00.000.000/0000-00"
                  />
                )}
              />
              {errors.cnpj ? <p className={errorCls}>{errors.cnpj.message}</p> : null}
            </div>
          </div>

          <div>
            <label className={labelCls}>Razão social</label>
            <input
              {...register("razaoSocial")}
              className={errors.razaoSocial ? inputErrorCls : inputValidCls}
              placeholder="Ex: Audio House LTDA"
            />
            {errors.razaoSocial ? <p className={errorCls}>{errors.razaoSocial.message}</p> : null}
          </div>

          <div className="grid grid-cols-2 gap-[10px]">
            <div>
              <label className={labelCls}>E-mail</label>
              <input
                type="email"
                {...register("email")}
                className={errors.email ? inputErrorCls : inputValidCls}
                placeholder="colaborador@email.com"
              />
              {errors.email ? <p className={errorCls}>{errors.email.message}</p> : null}
            </div>
            <div>
              <label className={labelCls}>WhatsApp</label>
              <Controller
                name="whatsapp"
                control={control}
                render={({ field }) => (
                  <input
                    name={field.name}
                    value={field.value ?? ""}
                    onChange={(e) => field.onChange(formatBrazilPhone(e.target.value))}
                    onBlur={field.onBlur}
                    ref={field.ref}
                    className={errors.whatsapp ? inputErrorCls : inputValidCls}
                    placeholder="(11) 99999-0000"
                  />
                )}
              />
              {errors.whatsapp ? <p className={errorCls}>{errors.whatsapp.message}</p> : null}
            </div>
          </div>

          <div>
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

        <div className="flex shrink-0 items-center gap-[8px] border-t border-[#2e2e2e] px-[18px] py-[14px]">
          {!isNew ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="rounded-[5px] border border-[#5a1515] bg-[#2a0a0a] px-[10px] py-[6px] text-[11px] text-[#F09595]"
            >
              Remover
            </button>
          ) : null}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-[5px] border border-[#2e2e2e] px-[12px] py-[6px] text-[11px] text-[#606060]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-[5px] border border-[#0F6E56] bg-[#1D9E75] px-[14px] py-[6px] text-[11px] font-[500] text-white"
          >
            {isSubmitting ? "Salvando…" : isNew ? "Adicionar" : "Salvar"}
          </button>
        </div>
      </form>
    </>
  );
}
