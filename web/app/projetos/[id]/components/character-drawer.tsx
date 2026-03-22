"use client";

import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ProjectCharacterDto } from "@/app/types/project-character";
import type { CastMemberDto } from "@/app/types/cast-member";
import {
  projectCharacterFormSchema,
  type ProjectCharacterFormInput,
  type ProjectCharacterFormData,
} from "../../schemas";

const IMPORTANCE_OPTIONS = [
  { value: "MAIN", label: "Principal", color: "#1D9E75" },
  { value: "SUPPORT", label: "Suporte", color: "#5B9BD5" },
  { value: "EXTRA", label: "Figurante", color: "#555" },
] as const;

const STATUS_STYLE: Record<
  string,
  { bg: string; border: string; text: string }
> = {
  AVAILABLE: {
    bg: "rgba(29,158,117,0.12)",
    border: "#1D9E75",
    text: "#5DCAA5",
  },
  BUSY: {
    bg: "rgba(186,117,23,0.12)",
    border: "#BA7517",
    text: "#EF9F27",
  },
  INACTIVE: { bg: "#1e1e1e", border: "#2e2e2e", text: "#505050" },
};

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Disponível",
  BUSY: "Em projeto",
  INACTIVE: "Inativo",
};

const inputCls =
  "w-full min-h-[36px] rounded-[6px] border border-[#2e2e2e] bg-[#111] px-[10px] py-[7px] text-[13px] text-[#e8e8e8] outline-none placeholder:text-[#505050] focus:border-[#1D9E75] transition-colors";
const inputErrCls =
  "w-full min-h-[36px] rounded-[6px] border border-[#E24B4A] bg-[#111] px-[10px] py-[7px] text-[13px] text-[#e8e8e8] outline-none focus:border-[#E24B4A] transition-colors";
const labelCls =
  "mb-[5px] block text-[10px] font-[600] uppercase tracking-[0.07em] text-[#505050]";
const errorCls = "mt-[3px] text-[11px] text-[#F09595]";
const sectionCls =
  "mb-[2px] border-t border-[#252525] pb-[2px] pt-[14px] text-[10px] font-[600] uppercase tracking-[0.08em] text-[#505050]";
const sectionFirstCls =
  "mb-[2px] pb-[2px] text-[10px] font-[600] uppercase tracking-[0.08em] text-[#505050]";

type Props = {
  character: ProjectCharacterDto | null;
  projectId: string;
  castMembers: CastMemberDto[];
  onClose: () => void;
  onSaved: () => void;
};

export function CharacterDrawer({
  character,
  projectId,
  castMembers,
  onClose,
  onSaved,
}: Props) {
  const isNew = character == null;
  const [selectedMember, setSelectedMember] = useState<CastMemberDto | null>(
    null,
  );

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<ProjectCharacterFormInput, unknown, ProjectCharacterFormData>({
    resolver: zodResolver(projectCharacterFormSchema),
    defaultValues: character
      ? {
          name: character.name,
          type: character.type ?? "",
          voiceType: character.voiceType ?? "",
          importance: character.importance,
          castMemberId: character.castMemberId ?? "",
          notes: character.notes ?? "",
        }
      : {
          name: "",
          type: "",
          voiceType: "",
          importance: "SUPPORT",
          castMemberId: "",
          notes: "",
        },
    mode: "onBlur",
    reValidateMode: "onChange",
  });

  const watchedImportance = watch("importance");
  const watchedVoiceType = watch("voiceType");
  const watchedCastMemberId = watch("castMemberId");
  const castMemberSelectValue =
    typeof watchedCastMemberId === "string" ? watchedCastMemberId : "";

  useEffect(() => {
    const values = character
      ? {
          name: character.name,
          type: character.type ?? "",
          voiceType: character.voiceType ?? "",
          importance: character.importance,
          castMemberId: character.castMemberId ?? "",
          notes: character.notes ?? "",
        }
      : {
          name: "",
          type: "",
          voiceType: "",
          importance: "SUPPORT" as const,
          castMemberId: "",
          notes: "",
        };
    reset(values);
    clearErrors();
    if (character?.castMemberId) {
      const m = castMembers.find((x) => x.id === character.castMemberId);
      setSelectedMember(m ?? null);
    } else {
      setSelectedMember(null);
    }
  }, [character, castMembers, reset, clearErrors]);

  const handleSelectMember = (memberId: string) => {
    if (!memberId) {
      setSelectedMember(null);
      setValue("castMemberId", "", { shouldDirty: true });
      setValue("voiceType", "", { shouldDirty: true });
      return;
    }
    const m = castMembers.find((x) => x.id === memberId) ?? null;
    setSelectedMember(m);
    setValue("castMemberId", memberId, { shouldDirty: true });
    if (m && m.specialties.length > 0) {
      setValue("voiceType", m.specialties[0], { shouldDirty: true });
    }
  };

  const availableMembers = castMembers.filter((m) => m.status !== "INACTIVE");

  const onSubmit = async (data: ProjectCharacterFormData) => {
    clearErrors("root");
    const url = isNew
      ? `/api/dubbing-projects/${projectId}/characters`
      : `/api/dubbing-projects/${projectId}/characters/${character!.id}`;
    const method = isNew ? "POST" : "PATCH";

    try {
      // API (`characterSchema`) aceita optional + "" para type/voiceType/notes, não `null`.
      const castMemberId =
        data.castMemberId != null && String(data.castMemberId).trim() !== ""
          ? data.castMemberId
          : null;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          importance: data.importance,
          castMemberId,
          type: data.type ?? "",
          voiceType: data.voiceType ?? "",
          notes: data.notes ?? "",
        }),
      });
      if (!res.ok) {
        setError("root", { message: "Erro ao salvar." });
        return;
      }
      onSaved();
    } catch {
      setError("root", { message: "Erro ao salvar." });
    }
  };

  const handleDelete = async () => {
    if (!character || !confirm(`Remover "${character.name}"?`)) return;
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
        aria-labelledby="character-drawer-title"
        className="fixed right-0 top-0 z-50 flex h-full w-[min(100vw,380px)] flex-col border-l border-[#2e2e2e] bg-[#1a1a1a] shadow-2xl"
      >
        <div className="flex h-[48px] shrink-0 items-center justify-between border-b border-[#2e2e2e] px-[18px]">
          <span
            id="character-drawer-title"
            className="text-[14px] font-[600] text-[#e8e8e8]"
          >
            {isNew ? "Novo personagem" : "Editar personagem"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-[24px] w-[24px] items-center justify-center rounded-[4px] text-[18px] leading-none text-[#505050] transition-colors hover:bg-[#252525] hover:text-[#e8e8e8]"
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-[16px] overflow-y-auto px-[18px] py-[16px]">
          {rootMsg ? (
            <div className="rounded-[5px] border border-[#5a1515] bg-[#2a0a0a] px-[10px] py-[8px] text-[11px] text-[#F09595]">
              {rootMsg}
            </div>
          ) : null}

          {/* Dublador — primeiro */}
          <div className="flex flex-col gap-[10px]">
            <div className={sectionFirstCls}>Dublador escalado</div>
            <div>
              <label className={labelCls} htmlFor="char-cast-member">
                Selecionar dublador
              </label>
              <select
                id="char-cast-member"
                value={castMemberSelectValue}
                onChange={(e) => handleSelectMember(e.target.value)}
                className={inputCls}
                autoFocus={isNew}
              >
                <option value="">— Sem dublador —</option>
                {availableMembers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                    {m.role ? ` · ${m.role}` : ""}
                    {m.status === "BUSY" ? " (em projeto)" : ""}
                  </option>
                ))}
              </select>
              <p className="mt-[3px] text-[10px] text-[#444]">
                Dubladores inativos não aparecem na lista.
              </p>
            </div>

            {selectedMember ? (
              <div className="rounded-[6px] border border-[#252525] bg-[#141414] p-[10px]">
                <div className="flex items-center justify-between gap-[8px]">
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-[500] text-[#e8e8e8]">
                      {selectedMember.name}
                    </div>
                    {selectedMember.role ? (
                      <div className="text-[11px] text-[#606060]">
                        {selectedMember.role}
                      </div>
                    ) : null}
                  </div>
                  <span
                    className="flex-shrink-0 rounded-[99px] px-[7px] py-[1px] text-[10px] font-[500]"
                    style={{
                      background: STATUS_STYLE[selectedMember.status]?.bg,
                      border: `0.5px solid ${STATUS_STYLE[selectedMember.status]?.border}`,
                      color: STATUS_STYLE[selectedMember.status]?.text,
                    }}
                  >
                    {STATUS_LABEL[selectedMember.status] ?? selectedMember.status}
                  </span>
                </div>

                {selectedMember.specialties.length > 0 ? (
                  <div className="mt-[8px]">
                    <div className="mb-[4px] text-[9px] font-[600] uppercase tracking-[0.06em] text-[#404040]">
                      Especialidades
                    </div>
                    <div className="flex flex-wrap gap-[4px]">
                      {selectedMember.specialties.map((sp) => (
                        <button
                          key={sp}
                          type="button"
                          onClick={() =>
                            setValue("voiceType", sp, { shouldDirty: true })
                          }
                          className="rounded-[3px] px-[6px] py-[1px] text-[10px] transition-colors"
                          style={
                            watchedVoiceType === sp
                              ? {
                                  background: "#0d3d2a",
                                  border: "0.5px solid #0F6E56",
                                  color: "#5DCAA5",
                                }
                              : {
                                  background: "#252525",
                                  border: "0.5px solid transparent",
                                  color: "#707070",
                                }
                          }
                        >
                          {sp}
                        </button>
                      ))}
                    </div>
                    <p className="mt-[4px] text-[9px] text-[#404040]">
                      Clique numa especialidade para usar como tipo de voz
                    </p>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Personagem */}
          <div className="flex flex-col gap-[10px]">
            <div className={sectionCls}>Personagem</div>
            <div>
              <label className={labelCls} htmlFor="char-name">
                Nome do personagem <span className="text-[#E24B4A]">*</span>
              </label>
              <input
                id="char-name"
                {...register("name")}
                onInvalid={(e) => e.preventDefault()}
                autoFocus={!isNew}
                className={errors.name ? inputErrCls : inputCls}
                placeholder="Ex: Goku"
              />
              {errors.name ? (
                <p className={errorCls}>{errors.name.message}</p>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-[8px]">
              <div>
                <label className={labelCls} htmlFor="char-type">
                  Tipo
                </label>
                <input
                  id="char-type"
                  {...register("type")}
                  className={errors.type ? inputErrCls : inputCls}
                  placeholder="Ex: Protagonista"
                />
                {errors.type ? (
                  <p className={errorCls}>{errors.type.message}</p>
                ) : null}
              </div>
              <div>
                <label className={labelCls} htmlFor="char-voice-type">
                  Tipo de voz
                </label>
                <input
                  id="char-voice-type"
                  {...register("voiceType")}
                  className={errors.voiceType ? inputErrCls : inputCls}
                  placeholder="Ex: Masculino adulto"
                />
                {errors.voiceType ? (
                  <p className={errorCls}>{errors.voiceType.message}</p>
                ) : null}
              </div>
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
                        className="flex-1 rounded-[99px] border px-[8px] py-[4px] text-[11px] font-[500] transition-colors"
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

          {/* Observações */}
          <div className="flex flex-col gap-[10px]">
            <div id="character-notes-heading" className={sectionCls}>
              Observações
            </div>
            <textarea
              id="character-notes"
              aria-labelledby="character-notes-heading"
              {...register("notes")}
              rows={3}
              className={`${errors.notes ? inputErrCls : inputCls} min-h-[70px] resize-y`}
              placeholder="Direção de voz, referências, notas..."
            />
            {errors.notes ? (
              <p className={errorCls}>{errors.notes.message}</p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-[8px] border-t border-[#2e2e2e] px-[18px] py-[14px]">
          {!isNew ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={isSubmitting}
              className="rounded-[5px] border border-[#5a1515] bg-[#2a0a0a] px-[10px] py-[6px] text-[11px] text-[#F09595] transition-colors hover:bg-[#3d0d0d] disabled:opacity-40"
            >
              Remover
            </button>
          ) : null}
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
