"use client";

import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  clientFormSchema,
  type ClientFormData,
  type ClientFormInput,
} from "@/app/(private)/clientes/schemas";
import type { ClientDto } from "@/app/types/client";
import { formatBrazilPhone } from "@/src/lib/phone-format";

const PAYMENT_METHOD_OPTIONS = [
  { value: "WIRE_TRANSFER" as const, label: "Wire Transfer" },
  { value: "WISE" as const, label: "Wise" },
];

type Props = {
  onClose: () => void;
  onCreated: (client: ClientDto) => void;
};

export function ClientQuickModal({ onClose, onCreated }: Props) {
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ClientFormInput, unknown, ClientFormData>({
    resolver: zodResolver(clientFormSchema),
    mode: "all",
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      country: "",
      notes: "",
      status: "ACTIVE",
      paymentMethod: "WIRE_TRANSFER",
    },
  });

  const onSubmit = async (data: ClientFormData) => {
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.status === 409) {
      const body = (await res.json()) as {
        error: string;
        field: string | null;
      };
      if (body.field === "email") {
        setError("email", { message: body.error });
      } else if (body.field === "phone") {
        setError("phone", { message: body.error });
      } else {
        setError("root", { message: body.error });
      }
      return;
    }
    if (!res.ok) {
      setError("root", { message: "Erro ao criar cliente." });
      return;
    }
    const created = (await res.json()) as { client: ClientDto };
    onCreated(created.client);
  };

  const inputCls =
    "w-full min-h-[34px] rounded-[5px] border border-[#2e2e2e] bg-[#111] px-[10px] py-[6px] text-[12px] text-[#e8e8e8] outline-none placeholder:text-[#505050] focus:border-[#1D9E75] transition-colors";
  const inputErrCls =
    "w-full min-h-[34px] rounded-[5px] border border-[#E24B4A] bg-[#111] px-[10px] py-[6px] text-[12px] text-[#e8e8e8] outline-none focus:border-[#E24B4A] transition-colors";
  const labelCls =
    "mb-[4px] block text-[10px] font-[600] uppercase tracking-[0.06em] text-[#505050]";
  const errorCls = "mt-[2px] text-[10px] text-[#F09595]";

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/60"
        onClick={onClose}
        aria-hidden
      />
      <div className="fixed left-1/2 top-1/2 z-[70] w-[360px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[10px] border border-[#2e2e2e] bg-[#1a1a1a] shadow-[0_16px_48px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between border-b border-[#252525] px-[16px] py-[12px]">
          <span className="text-[13px] font-[600] text-[#e8e8e8]">
            Novo cliente
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-[22px] w-[22px] items-center justify-center rounded-[4px] text-[16px] text-[#505050] transition-colors hover:bg-[#252525] hover:text-[#e8e8e8]"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-[10px] p-[16px]"
        >
          {errors.root ? (
            <div className="rounded-[5px] border border-[#5a1515] bg-[#2a0a0a] px-[10px] py-[6px] text-[10px] text-[#F09595]">
              {errors.root.message}
            </div>
          ) : null}
          <div>
            <label className={labelCls}>
              Nome do cliente / estúdio{" "}
              <span className="text-[#E24B4A]">*</span>
            </label>
            <input
              {...register("name")}
              autoFocus
              className={errors.name ? inputErrCls : inputCls}
              placeholder="Ex: Funimation BR"
            />
            {errors.name ? (
              <p className={errorCls}>{errors.name.message}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-[8px]">
            <div>
              <label className={labelCls}>E-mail</label>
              <input
                type="email"
                {...register("email")}
                className={errors.email ? inputErrCls : inputCls}
                placeholder="contato@email.com"
              />
              {errors.email ? (
                <p className={errorCls}>{errors.email.message}</p>
              ) : null}
            </div>
            <div>
              <label className={labelCls}>Telefone</label>
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(formatBrazilPhone(e.target.value))
                    }
                    onBlur={field.onBlur}
                    ref={field.ref}
                    className={errors.phone ? inputErrCls : inputCls}
                    placeholder="(11) 3000-0000"
                  />
                )}
              />
              {errors.phone ? (
                <p className={errorCls}>{errors.phone.message}</p>
              ) : null}
            </div>
          </div>
          <div>
            <label className={labelCls}>País / Origem</label>
            <input
              {...register("country")}
              className={inputCls}
              placeholder="Ex: Brasil"
            />
          </div>
          <div>
            <label className={labelCls}>
              Pagamento <span className="text-[#E24B4A]">*</span>
            </label>
            <select
              {...register("paymentMethod")}
              className={errors.paymentMethod ? inputErrCls : inputCls}
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
          <div className="flex justify-end gap-[6px] border-t border-[#252525] pt-[10px]">
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
              {isSubmitting ? "Criando…" : "Criar e selecionar"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
