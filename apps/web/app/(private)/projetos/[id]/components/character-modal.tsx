"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { ProjectCharacterDto } from "@/app/types/project-character";
import { useConfirm } from "@/app/components/confirm-provider";

const schema = z.object({
  name: z.string().min(1, "Nome do personagem é obrigatório").max(80),
  voiceType: z.union([z.string().max(60), z.literal("")]).optional(),
  importance: z.enum(["MAIN", "SUPPORT", "EXTRA"]),
  notes: z.union([z.string().max(500), z.literal("")]).optional(),
});

type FormData = z.infer<typeof schema>;

const IMPORTANCE_OPTIONS = [
  { value: "MAIN", label: "Principal", color: "#1D9E75" },
  { value: "SUPPORT", label: "Suporte", color: "#5B9BD5" },
  { value: "EXTRA", label: "Figurante", color: "#555" },
] as const;

const inputCls =
  "w-full min-h-[34px] rounded-[5px] border border-[#2e2e2e] bg-[#111] px-[10px] py-[6px] text-[12px] text-[#e8e8e8] outline-none placeholder:text-[#505050] focus:border-[#1D9E75] transition-colors";
const inputErrCls = inputCls
  .replace("border-[#2e2e2e]", "border-[#E24B4A]")
  .replace("focus:border-[#1D9E75]", "focus:border-[#E24B4A]");
const labelCls =
  "mb-[4px] block text-[10px] font-[600] uppercase tracking-[0.06em] text-[#505050]";
const errorCls = "mt-[2px] text-[10px] text-[#F09595]";

type Props = {
  character: ProjectCharacterDto | null;
  projectId: string;
  /** Mantida por compatibilidade de chamada; modal não usa mais casting. */
  castMembers?: unknown[];
  onClose: () => void;
  onSaved: () => void;
};

export function CharacterModal({
  character,
  projectId,
  onClose,
  onSaved,
}: Props) {
  const confirm = useConfirm();
  const isNew = character == null;

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: character?.name ?? "",
      voiceType: character?.voiceType ?? "",
      importance: character?.importance ?? "SUPPORT",
      notes: character?.notes ?? "",
    },
    mode: "all",
  });

  useEffect(() => {
    reset({
      name: character?.name ?? "",
      voiceType: character?.voiceType ?? "",
      importance: character?.importance ?? "SUPPORT",
      notes: character?.notes ?? "",
    });
  }, [character, reset]);

  const watchedImportance = watch("importance");

  const onSubmit = async (data: FormData) => {
    const url = isNew
      ? `/api/dubbing-projects/${projectId}/characters`
      : `/api/dubbing-projects/${projectId}/characters/${character!.id}`;
    const method = isNew ? "POST" : "PATCH";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        voiceType: data.voiceType || null,
        importance: data.importance,
        notes: data.notes || null,
      }),
    });
    if (!res.ok) {
      setError("root", { message: "Erro ao salvar." });
      return;
    }
    onSaved();
  };

  const handleDelete = async () => {
    if (!character) return;
    const ok = await confirm({
      title: "Remover personagem",
      description: `Confirma remover "${character.name}" do projeto? Esta ação não pode ser desfeita.`,
      variant: "danger",
      confirmLabel: "Sim, remover",
    });
    if (!ok) return;
    const res = await fetch(
      `/api/dubbing-projects/${projectId}/characters/${character.id}`,
      { method: "DELETE" },
    );
    if (res.ok) onSaved();
    else setError("root", { message: "Erro ao remover." });
  };

  const rootMsg =
    errors.root && typeof errors.root === "object" && "message" in errors.root
      ? String(errors.root.message)
      : undefined;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/60"
        onClick={onClose}
        aria-hidden
      />

      <div
        className="fixed left-1/2 top-1/2 z-[70] w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[10px] border border-[#2e2e2e] bg-[#1a1a1a] shadow-[0_20px_60px_rgba(0,0,0,0.7)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="character-modal-title"
      >
        <div className="flex items-center justify-between border-b border-[#252525] px-[16px] py-[12px]">
          <span
            id="character-modal-title"
            className="text-[13px] font-[600] text-[#e8e8e8]"
          >
            {isNew ? "Adicionar personagem" : "Editar personagem"}
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

        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="flex flex-col gap-[12px] p-[16px]">
            {rootMsg ? (
              <div className="rounded-[5px] border border-[#5a1515] bg-[#2a0a0a] px-[10px] py-[7px] text-[11px] text-[#F09595]">
                {rootMsg}
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-[8px]">
              <div>
                <label className={labelCls}>
                  Nome <span className="text-[#E24B4A]">*</span>
                </label>
                <input
                  {...register("name")}
                  autoFocus={isNew}
                  className={errors.name ? inputErrCls : inputCls}
                  placeholder="Ex: Goku"
                />
                {errors.name ? (
                  <p className={errorCls}>{errors.name.message}</p>
                ) : null}
              </div>
              <div>
                <label className={labelCls}>Tipo de voz</label>
                <input
                  {...register("voiceType")}
                  className={inputCls}
                  placeholder="Ex: Masculino adulto"
                />
              </div>
            </div>

            <div>
              <label className={labelCls}>Observações</label>
              <textarea
                {...register("notes")}
                rows={2}
                className={`${inputCls} min-h-[60px] resize-y`}
                placeholder="Opcional"
              />
            </div>

            <div>
              <label className={labelCls}>Importância</label>
              <Controller
                name="importance"
                control={control}
                render={({ field }) => (
                  <div className="flex gap-[6px]">
                    {IMPORTANCE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => field.onChange(opt.value)}
                        className="flex-1 rounded-[99px] border py-[5px] text-[11px] font-[500] transition-colors"
                        style={
                          watchedImportance === opt.value
                            ? {
                                background: `${opt.color}22`,
                                borderColor: opt.color,
                                color: opt.color,
                              }
                            : {
                                background: "transparent",
                                borderColor: "#2e2e2e",
                                color: "#606060",
                              }
                        }
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              />
            </div>
          </div>

          <div className="flex items-center gap-[8px] border-t border-[#252525] px-[16px] py-[12px]">
            {!isNew ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="rounded-[5px] border border-[#5a1515] bg-[#2a0a0a] px-[10px] py-[5px] text-[11px] text-[#F09595] transition-colors hover:bg-[#3d0d0d] disabled:opacity-40"
              >
                Remover
              </button>
            ) : null}
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-[5px] border border-[#2e2e2e] px-[12px] py-[5px] text-[11px] text-[#606060] transition-colors hover:bg-[#252525] disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-[5px] border border-[#0F6E56] bg-[#1D9E75] px-[14px] py-[5px] text-[11px] font-[500] text-white transition-colors hover:bg-[#0F6E56] disabled:opacity-40"
            >
              {isSubmitting ? "Salvando…" : isNew ? "Adicionar" : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
