"use client";

import { useEffect } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  clientFormSchema,
  type ClientFormData,
  type ClientFormInput,
} from "../schemas";
import type { ClientDto } from "@/app/types/client";
import {
  formatBrazilPhone,
  normalizePhoneForStorage,
} from "@/src/lib/phone-format";

const STATUS_OPTIONS = [
  { value: "ACTIVE" as const, label: "Ativo", color: "#1D9E75" },
  { value: "INACTIVE" as const, label: "Inativo", color: "#555" },
];

const PAYMENT_METHOD_OPTIONS = [
  { value: "WIRE_TRANSFER" as const, label: "Wire Transfer" },
  { value: "WISE" as const, label: "Wise" },
];

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
const sectionFirstCls =
  "mb-[2px] pb-[2px] text-[10px] font-[600] uppercase tracking-[0.08em] text-[#505050]";
const sectionCls =
  "mb-[2px] border-t border-[#252525] pb-[2px] pt-[14px] text-[10px] font-[600] uppercase tracking-[0.08em] text-[#505050]";

function getDefaults(_c: ClientDto | null): ClientFormInput {
  return {
    name: "",
    email: "",
    phone: "",
    country: "",
    notes: "",
    status: "ACTIVE",
    paymentMethod: "WIRE_TRANSFER",
  };
}

type Props = {
  onClose: () => void;
  onSaved: () => void;
};

export function ClientDrawer({ onClose, onSaved }: Props) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormInput, unknown, ClientFormData>({
    resolver: zodResolver(clientFormSchema) as Resolver<
      ClientFormInput,
      unknown,
      ClientFormData
    >,
    defaultValues: getDefaults(null),
    mode: "all",
  });

  useEffect(() => {
    reset(getDefaults(null));
    clearErrors();
  }, [reset, clearErrors]);

  const onSubmit = async (data: ClientFormData) => {
    clearErrors("root");
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name.trim(),
          email: data.email.trim(),
          phone: normalizePhoneForStorage(data.phone) ?? "",
          country: data.country?.trim() ?? "",
          notes: data.notes?.trim() ?? "",
          status: data.status,
          paymentMethod: data.paymentMethod,
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

      if (!res.ok) throw new Error(await res.text());
      onSaved();
    } catch {
      setError("root", { message: "Erro ao salvar. Tente novamente." });
    }
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
        aria-labelledby="client-drawer-title"
        className="fixed right-0 top-0 z-50 flex h-full w-[min(100vw,380px)] flex-col border-l border-[#2e2e2e] bg-[#1a1a1a] shadow-2xl"
      >
        <div className="flex h-[48px] shrink-0 items-center justify-between border-b border-[#2e2e2e] px-[18px]">
          <span
            id="client-drawer-title"
            className="text-[14px] font-[600] text-[#e8e8e8]"
          >
            Novo cliente
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
              <label className={labelCls} htmlFor="client-name">
                Nome <span className="text-[#E24B4A]">*</span>
              </label>
              <input
                id="client-name"
                {...register("name")}
                onInvalid={(e) => e.preventDefault()}
                className={errors.name ? inputErrorCls : inputValidCls}
                placeholder="Ex: Estúdio X"
                autoFocus
              />
              {errors.name ? (
                <p className={errorCls}>{errors.name.message}</p>
              ) : null}
            </div>
            <div>
              <label className={labelCls} htmlFor="client-email">
                E-mail <span className="text-[#E24B4A]">*</span>
              </label>
              <input
                id="client-email"
                type="email"
                {...register("email")}
                onInvalid={(e) => e.preventDefault()}
                className={errors.email ? inputErrorCls : inputValidCls}
                placeholder="contato@email.com"
              />
              {errors.email ? (
                <p className={errorCls}>{errors.email.message}</p>
              ) : null}
            </div>
            <div>
              <label className={labelCls} htmlFor="client-phone">
                Telefone <span className="text-[#E24B4A]">*</span>
              </label>
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <input
                    id="client-phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(formatBrazilPhone(e.target.value))
                    }
                    onBlur={field.onBlur}
                    ref={field.ref}
                    className={errors.phone ? inputErrorCls : inputValidCls}
                    placeholder="(11) 3000-0000"
                  />
                )}
              />
              {errors.phone ? (
                <p className={errorCls}>{errors.phone.message}</p>
              ) : null}
            </div>
            <div>
              <label className={labelCls} htmlFor="client-country">
                País / origem <span className="text-[#E24B4A]">*</span>
              </label>
              <input
                id="client-country"
                {...register("country")}
                className={errors.country ? inputErrorCls : inputValidCls}
                placeholder="Ex: Brasil"
              />
              {errors.country ? (
                <p className={errorCls}>{errors.country.message}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-[10px]">
            <div className={sectionCls}>Status</div>
            <Controller
              name="status"
              control={control}
              render={({ field }) => (
                <div className="flex flex-wrap gap-[6px]">
                  {STATUS_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      type="button"
                      onClick={() => field.onChange(s.value)}
                      className={`rounded-[99px] border px-[10px] py-[4px] text-[11px] font-[500] transition-colors ${
                        field.value === s.value
                          ? "border-[#1D9E75] bg-[rgba(29,158,117,0.15)] text-[#5DCAA5]"
                          : "border-[#2e2e2e] text-[#606060] hover:border-[#404040]"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          <div className="flex flex-col gap-[10px]">
            <div className={sectionCls}>Pagamento</div>
            <div>
              <label className={labelCls} htmlFor="client-payment-method">
                Método de pagamento
              </label>
              <select
                id="client-payment-method"
                {...register("paymentMethod")}
                className={errors.paymentMethod ? inputErrorCls : inputValidCls}
              >
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.paymentMethod ? (
                <p className={errorCls}>{errors.paymentMethod.message}</p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-[10px]">
            <div className={sectionCls}>Observações</div>
            <textarea
              {...register("notes")}
              rows={3}
              maxLength={2000}
              className={`${errors.notes ? inputErrorCls : inputValidCls} min-h-[72px] resize-none`}
              placeholder="Notas internas…"
            />
            {errors.notes ? (
              <p className={errorCls}>{errors.notes.message}</p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-[8px] border-t border-[#2e2e2e] px-[18px] py-[14px]">
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
            {isSubmitting ? "Salvando…" : "Adicionar"}
          </button>
        </div>
      </form>
    </>
  );
}
