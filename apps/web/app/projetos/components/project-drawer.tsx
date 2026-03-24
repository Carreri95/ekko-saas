"use client";

import { useEffect, useState } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ClientSelect } from "./client-select";
import { ClientQuickModal } from "./client-quick-modal";
import {
  dubbingProjectFormSchema,
  type DubbingProjectFormData,
  type DubbingProjectFormInput,
} from "../schemas";
import type { PaymentType } from "../domain";
import { DateInput } from "@/app/components/date-input";
import { LanguageCombobox } from "./language-combobox";
import { CurrencyValueField } from "./currency-value-field";
import {
  contractTotalHint,
  formUnitToStoredTotal,
  normalizeMoneyForStorage,
  valueFieldLabel,
} from "../lib/project-finance";

const PAYMENT_OPTIONS: { value: PaymentType; label: string }[] = [
  { value: "PER_PROJECT", label: "Valor fixo por projeto" },
  { value: "PER_EPISODE", label: "Por episódio" },
  { value: "PER_MINUTE", label: "Por minuto de áudio" },
];

const inputCls = `
  w-full min-h-[36px] rounded-[6px] border border-[#2e2e2e] bg-[#111]
  px-[10px] py-[8px] text-[13px] leading-snug text-[#e8e8e8] outline-none
  placeholder:text-[#505050]
  focus:border-[#1D9E75] focus:ring-0
  transition-colors
`.trim();

const inputValidCls = inputCls;
const inputErrorCls = `
  w-full min-h-[36px] rounded-[6px] border border-[#E24B4A] bg-[#111]
  px-[10px] py-[8px] text-[13px] leading-snug text-[#e8e8e8] outline-none
  placeholder:text-[#505050]
  focus:border-[#E24B4A] focus:ring-0
  transition-colors
`.trim();

const labelCls =
  "mb-[6px] block text-[10px] font-[600] uppercase tracking-[0.07em] text-[#606060]";
const errorCls = "mt-[3px] text-[11px] text-[#F09595]";

const sectionClsFirst =
  "mb-[2px] pb-[2px] text-[10px] font-[600] uppercase tracking-[0.08em] text-[#505050]";
const sectionCls =
  "mb-[2px] border-t border-[#252525] pb-[2px] pt-[16px] text-[10px] font-[600] uppercase tracking-[0.08em] text-[#505050]";

type Props = {
  onClose: () => void;
  onSaved: () => void;
};

function getNewDefaults(): DubbingProjectFormInput {
  return {
    name: "",
    client: "",
    clientId: null,
    startDate: "",
    deadline: "",
    episodes: "",
    durationMin: "",
    language: "ja",
    value: "",
    valueCurrency: "BRL",
    paymentType: "PER_PROJECT",
    notes: "",
  };
}

export function ProjectDrawer({ onClose, onSaved }: Props) {
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientListRefresh, setClientListRefresh] = useState(0);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<DubbingProjectFormInput, unknown, DubbingProjectFormData>({
    resolver: zodResolver(
      dubbingProjectFormSchema,
    ) as Resolver<DubbingProjectFormInput, unknown, DubbingProjectFormData>,
    defaultValues: getNewDefaults(),
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  useEffect(() => {
    reset(getNewDefaults());
    clearErrors();
  }, [reset, clearErrors]);

  const paymentType = watch("paymentType") ?? "PER_PROJECT";
  const watchedValue = watch("value");
  const watchedCurrency = watch("valueCurrency");
  const watchedEpisodes = watch("episodes");
  const watchedDurationMin = watch("durationMin");
  const numVal =
    typeof watchedValue === "number"
      ? watchedValue
      : parseFloat(String(watchedValue ?? "").replace(",", ".")) || 0;
  const numEp =
    typeof watchedEpisodes === "number"
      ? watchedEpisodes
      : parseInt(String(watchedEpisodes ?? ""), 10) || 0;
  const numMin =
    typeof watchedDurationMin === "number"
      ? watchedDurationMin
      : parseInt(String(watchedDurationMin ?? ""), 10) || 0;

  const totalContractHint = contractTotalHint(
    numVal,
    paymentType,
    numEp,
    numMin,
    watchedCurrency ?? "BRL",
  );

  const onSubmit = async (data: DubbingProjectFormData) => {
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
      ...(data.notes?.trim() ? { notes: data.notes.trim() } : {}),
    };

    try {
      const res = await fetch("/api/dubbing-projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        let detail = "";
        try {
          const j = (await res.json()) as { error?: string };
          if (j.error) detail = j.error;
        } catch {
          detail = await res.text();
        }
        setError("root", {
          message:
            detail.trim() ||
            `Erro ao salvar (${res.status}). Tente novamente.`,
        });
        return;
      }
      onSaved();
    } catch {
      setError("root", {
        message: "Erro ao salvar. Tente novamente.",
      });
    }
  };

  const formShellClass =
    "fixed right-0 top-0 z-50 flex h-full w-[min(100vw,380px)] max-w-[100vw] flex-col border-l border-[#2e2e2e] bg-[#1a1a1a] shadow-2xl";

  const formEl = (
    <form
      onSubmit={handleSubmit(onSubmit)}
      noValidate
      className={formShellClass}
      role="dialog"
      aria-modal={true}
      aria-labelledby="project-drawer-title"
    >
      <div
        className="flex h-[48px] shrink-0 items-center justify-between border-b border-[#2e2e2e] px-[18px]"
      >
        <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
          <div className="min-w-0">
            <span
              id="project-drawer-title"
              className="text-[14px] font-[600] tracking-tight text-[#e8e8e8]"
            >
              Novo projeto
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-[24px] w-[24px] shrink-0 items-center justify-center rounded-[4px] text-[18px] leading-none text-[#505050] transition-colors hover:bg-[#252525] hover:text-[#e8e8e8]"
            aria-label="Fechar painel"
          >
            ×
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-[18px] py-[16px]">
        {errors.root ? (
          <div className="rounded-[5px] border border-[#5a1515] bg-[#2a0a0a] px-[10px] py-[8px] text-[11px] text-[#F09595]">
            {errors.root.message}
          </div>
        ) : null}

        <div className="flex flex-col gap-[12px]">
          <div className={sectionClsFirst}>Identificação</div>
          <div>
            <label className={labelCls} htmlFor="project-name">
              Nome do projeto <span className="text-[#E24B4A]">*</span>
            </label>
            <input
              id="project-name"
              {...register("name")}
              onInvalid={(e) => e.preventDefault()}
              className={errors.name ? inputErrorCls : inputValidCls}
              placeholder="Ex: Dragon Ball Super T3"
              autoFocus
            />
            {errors.name ? (
              <p className={errorCls}>{errors.name.message}</p>
            ) : null}
          </div>
          <div>
            <label className={labelCls} htmlFor="project-client">
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
                    (watch("clientId") as string | null | undefined) ?? null
                  }
                  refreshToken={clientListRefresh}
                  onChange={(text, id) => {
                    field.onChange(text);
                    setValue("clientId", id, { shouldDirty: true });
                  }}
                  onCreateNew={() => setClientModalOpen(true)}
                  error={!!errors.client}
                />
              )}
            />
            {errors.client ? (
              <p className={errorCls}>{errors.client.message}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-[12px]">
          <div className={sectionCls}>Datas</div>
          <div className="flex flex-col gap-3">
            <div>
              <label className={labelCls} htmlFor="project-start-date">
                Início <span className="text-[#E24B4A]">*</span>
              </label>
              <Controller
                name="startDate"
                control={control}
                render={({ field }) => (
                  <DateInput
                    id="project-start-date"
                    value={
                      field.value === null || field.value === undefined
                        ? ""
                        : String(field.value)
                    }
                    onChange={field.onChange}
                    placeholder="dd/mm/aaaa"
                    className={errors.startDate ? inputErrorCls : inputValidCls}
                  />
                )}
              />
              {errors.startDate ? (
                <p className={errorCls}>{errors.startDate.message}</p>
              ) : null}
            </div>
            <div>
              <label className={labelCls} htmlFor="project-deadline">
                Prazo de entrega <span className="text-[#E24B4A]">*</span>
              </label>
              <Controller
                name="deadline"
                control={control}
                render={({ field }) => (
                  <DateInput
                    id="project-deadline"
                    value={
                      field.value === null || field.value === undefined
                        ? ""
                        : String(field.value)
                    }
                    onChange={field.onChange}
                    placeholder="dd/mm/aaaa"
                    className={errors.deadline ? inputErrorCls : inputValidCls}
                  />
                )}
              />
              {errors.deadline ? (
                <p className={errorCls}>{errors.deadline.message}</p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-[12px]">
          <div className={sectionCls}>Escopo</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            <div>
              <label className={labelCls} htmlFor="project-episodes">
                Nº de episódios <span className="text-[#E24B4A]">*</span>
              </label>
              <input
                id="project-episodes"
                type="number"
                min={1}
                {...register("episodes")}
                className={errors.episodes ? inputErrorCls : inputValidCls}
                placeholder="Ex: 12"
              />
              {errors.episodes ? (
                <p className={errorCls}>{errors.episodes.message}</p>
              ) : null}
            </div>
            <div>
              <label className={labelCls} htmlFor="project-duration">
                Minutagem total (min) <span className="text-[#E24B4A]">*</span>
              </label>
              <input
                id="project-duration"
                type="number"
                min={1}
                {...register("durationMin")}
                className={errors.durationMin ? inputErrorCls : inputValidCls}
                placeholder="Ex: 264"
              />
              {errors.durationMin ? (
                <p className={errorCls}>{errors.durationMin.message}</p>
              ) : null}
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="project-original-language">
              Idioma original <span className="text-[#E24B4A]">*</span>
            </label>
            <Controller
              name="language"
              control={control}
              render={({ field }) => (
                <LanguageCombobox
                  id="project-original-language"
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            {errors.language ? (
              <p className={errorCls}>{errors.language.message}</p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-[12px]">
          <div className={sectionCls}>Financeiro</div>
          <div>
            <label className={labelCls} htmlFor="project-payment">
              Forma de pagamento
            </label>
            <select
              id="project-payment"
              {...register("paymentType")}
              className={inputValidCls}
            >
              {PAYMENT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="project-value">
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
                      id="project-value"
                      value={
                        typeof valField.value === "number" ? valField.value : 0
                      }
                      onChange={valField.onChange}
                      currency={curField.value ?? "BRL"}
                      onCurrencyChange={curField.onChange}
                      error={!!errors.value}
                      inputCls={inputValidCls}
                      inputErrCls={inputErrorCls}
                    />
                  )}
                />
              )}
            />
            {totalContractHint ? (
              <p className="mt-[4px] text-[10px] text-[#5DCAA5]">
                {totalContractHint}
              </p>
            ) : null}
            {errors.value ? (
              <p className={errorCls}>{errors.value.message}</p>
            ) : null}
          </div>
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
          {isSubmitting ? "Salvando…" : "Criar projeto"}
        </button>
      </div>
    </form>
  );

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-black/50"
        onClick={onClose}
        aria-label="Fechar painel"
      />
      {formEl}
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
    </>
  );
}
