"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  castMemberFormSchema,
  type CastMemberFormData,
  type CastMemberFormInput,
} from "../schemas";
import type { CastMemberDto } from "@/app/types/cast-member";
import {
  formatBrazilPhone,
  normalizePhoneForStorage,
} from "@/src/lib/phone-format";

const STATUS_OPTIONS = [
  { value: "AVAILABLE", label: "Disponível", color: "#1D9E75" },
  { value: "BUSY", label: "Em projeto", color: "#BA7517" },
  { value: "INACTIVE", label: "Inativo", color: "#555" },
] as const;

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
const sectionCls =
  "mb-[2px] border-t border-[#252525] pb-[2px] pt-[14px] text-[10px] font-[600] uppercase tracking-[0.08em] text-[#505050]";
const sectionFirstCls =
  "mb-[2px] pb-[2px] text-[10px] font-[600] uppercase tracking-[0.08em] text-[#505050]";

function getDefaults(m: CastMemberDto | null): CastMemberFormInput {
  if (!m)
    return {
      name: "",
      role: "",
      whatsapp: "",
      email: "",
      specialties: [],
      status: "AVAILABLE",
      notes: "",
    };
  return {
    name: m.name,
    role: m.role ?? "",
    whatsapp: formatBrazilPhone(m.whatsapp ?? ""),
    email: m.email ?? "",
    specialties: m.specialties ?? [],
    status: m.status,
    notes: m.notes ?? "",
  };
}

type Props = {
  member: CastMemberDto | null;
  onClose: () => void;
  onSaved: () => void;
};

export function CastMemberDrawer({ member, onClose, onSaved }: Props) {
  const isNew = member == null;
  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<CastMemberFormInput>({
    resolver: zodResolver(castMemberFormSchema),
    defaultValues: getDefaults(member),
    mode: "all",
  });

  useEffect(() => {
    reset(getDefaults(member));
    clearErrors();
  }, [member, reset, clearErrors]);

  const onSubmit = async (data: CastMemberFormData) => {
    clearErrors("root");
    const url = isNew ? "/api/cast-members" : `/api/cast-members/${member!.id}`;
    const method = isNew ? "POST" : "PATCH";
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name.trim(),
          role: data.role.trim(),
          whatsapp: normalizePhoneForStorage(data.whatsapp) ?? "",
          email: data.email.trim(),
          specialties: data.specialties,
          status: data.status,
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

      if (!res.ok) throw new Error(await res.text());
      onSaved();
    } catch {
      setError("root", { message: "Erro ao salvar. Tente novamente." });
    }
  };

  const handleDelete = async () => {
    if (!member || !confirm(`Remover "${member.name}" do elenco?`)) return;
    const res = await fetch(`/api/cast-members/${member.id}`, {
      method: "DELETE",
    });
    if (res.ok) onSaved();
    else setError("root", { message: "Erro ao excluir." });
  };

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        aria-label="Fechar"
      />
      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        role="dialog"
        aria-modal="true"
        aria-labelledby="cast-drawer-title"
        className="fixed right-0 top-0 z-50 flex h-full w-[min(100vw,380px)] flex-col border-l border-[#2e2e2e] bg-[#1a1a1a] shadow-2xl"
      >
        <div className="flex h-[48px] shrink-0 items-center justify-between border-b border-[#2e2e2e] px-[18px]">
          <span
            id="cast-drawer-title"
            className="text-[14px] font-[600] text-[#e8e8e8]"
          >
            {isNew ? "Novo dublador" : "Editar dublador"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-[24px] w-[24px] items-center justify-center rounded-[4px] text-[18px] leading-none text-[#505050] transition-colors hover:bg-[#252525] hover:text-[#e8e8e8]"
          >
            ×
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-[18px] py-[16px]">
          {errors.root ? (
            <div className="rounded-[5px] border border-[#5a1515] bg-[#2a0a0a] px-[10px] py-[8px] text-[11px] text-[#F09595]">
              {errors.root.message}
            </div>
          ) : null}
          <div className="flex flex-col gap-[10px]">
            <div className={sectionFirstCls}>Identificação</div>

            <div>
              <label className={labelCls} htmlFor="cast-name">
                Nome completo <span className="text-[#E24B4A]">*</span>
              </label>
              <input
                id="cast-name"
                {...register("name")}
                onInvalid={(e) => e.preventDefault()}
                className={errors.name ? inputErrorCls : inputValidCls}
                placeholder="Ex: Maria Silva"
                autoFocus
              />
              {errors.name ? (
                <p className={errorCls}>{errors.name.message}</p>
              ) : null}
            </div>

            <div>
              <label className={labelCls} htmlFor="cast-role">
                Função / Cargo <span className="text-[#E24B4A]">*</span>
              </label>
              <input
                id="cast-role"
                {...register("role")}
                className={errors.role ? inputErrorCls : inputValidCls}
                placeholder="Ex: Dubladora sênior"
              />
              {errors.role ? (
                <p className={errorCls}>{errors.role.message}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-[10px]">
            <div className={sectionCls}>Contato</div>

            <div>
              <label className={labelCls} htmlFor="cast-whatsapp">
                WhatsApp <span className="text-[#E24B4A]">*</span>
              </label>
              <Controller
                name="whatsapp"
                control={control}
                render={({ field }) => (
                  <input
                    id="cast-whatsapp"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    name={field.name}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(formatBrazilPhone(e.target.value))
                    }
                    onBlur={field.onBlur}
                    ref={field.ref}
                    className={errors.whatsapp ? inputErrorCls : inputValidCls}
                    placeholder="(11) 99999-0000"
                  />
                )}
              />
              {errors.whatsapp ? (
                <p className={errorCls}>{errors.whatsapp.message}</p>
              ) : null}
            </div>

            <div>
              <label className={labelCls} htmlFor="cast-email">
                E-mail <span className="text-[#E24B4A]">*</span>
              </label>
              <input
                id="cast-email"
                type="email"
                {...register("email")}
                onInvalid={(e) => e.preventDefault()}
                className={errors.email ? inputErrorCls : inputValidCls}
                placeholder="dublador@email.com"
              />
              {errors.email ? (
                <p className={errorCls}>{errors.email.message}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-[10px]">
            <div className={sectionCls}>
              Especialidades <span className="text-[#E24B4A]">*</span>
            </div>
            <Controller
              name="specialties"
              control={control}
              render={({ field }) => (
                <SpecialtiesInput
                  value={field.value ?? []}
                  onChange={field.onChange}
                  error={!!errors.specialties}
                  inputValidCls={inputValidCls}
                />
              )}
            />
            <p className="text-[10px] text-[#444]">
              Digite e pressione Enter para adicionar. Ex: Feminino adulto,
              Anime, Narração.
            </p>
            {errors.specialties ? (
              <p className={errorCls}>
                {typeof errors.specialties === "object" &&
                "message" in errors.specialties
                  ? (errors.specialties as { message: string }).message
                  : "Adicione pelo menos uma especialidade"}
              </p>
            ) : null}
          </div>

          <div className="flex flex-col gap-[10px]">
            <div className={sectionCls}>Status</div>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <div className="flex gap-[6px]">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => field.onChange(s.value)}
                      className="flex-1 rounded-[99px] border px-[10px] py-[5px] text-[11px] font-[500] transition-colors"
                      style={
                        field.value === s.value
                          ? {
                              background: `${s.color}22`,
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
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          {!isNew ? (
            <div className="flex flex-col gap-[10px]">
              <div className={sectionCls}>Observações</div>
              <textarea
                id="cast-notes"
                {...register("notes")}
                rows={3}
                className={`${
                  errors.notes ? inputErrorCls : inputValidCls
                } resize-y min-h-[80px]`}
                placeholder="Notas internas sobre este dublador..."
              />
              {errors.notes ? (
                <p className={errorCls}>{errors.notes.message}</p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-[8px] border-t border-[#2e2e2e] px-[18px] py-[14px]">
          {!isNew && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="rounded-[5px] border border-[#5a1515] bg-[#2a0a0a] px-[10px] py-[6px] text-[11px] text-[#F09595] transition-colors hover:bg-[#3d0d0d] disabled:opacity-40"
            >
              Remover
            </button>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-[5px] border border-[#2e2e2e] px-[12px] py-[6px] text-[11px] text-[#606060] transition-colors hover:bg-[#252525] disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-[5px] border border-[#0F6E56] bg-[#1D9E75] px-[14px] py-[6px] text-[11px] font-[500] text-white transition-colors hover:bg-[#0F6E56] disabled:opacity-40"
          >
            {isSubmitting ? "Salvando…" : isNew ? "Adicionar" : "Salvar"}
          </button>
        </div>
      </form>
    </>
  );
}

function SpecialtiesInput({
  value,
  onChange,
  error,
  inputValidCls,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  error: boolean;
  inputValidCls: string;
}) {
  const [input, setInput] = useState("");

  const add = () => {
    const trimmed = input.trim();
    if (!trimmed || value.includes(trimmed) || value.length >= 10) return;
    onChange([...value, trimmed]);
    setInput("");
  };

  const remove = (tag: string) => onChange(value.filter((t) => t !== tag));

  return (
    <div className="flex flex-col gap-[6px]">
      <div
        className={`flex gap-[6px] rounded-[6px] ${error ? "ring-1 ring-[#E24B4A]" : ""}`}
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
          className={inputValidCls}
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
