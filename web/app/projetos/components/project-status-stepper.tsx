"use client";

import type { DubbingProjectStatus } from "../domain";

const STATUS_STEPS: {
  value: DubbingProjectStatus;
  label: string;
  color: string;
}[] = [
  { value: "SPOTTING", label: "Spotting", color: "#5B9BD5" },
  { value: "ADAPTATION", label: "Adaptação", color: "#BA7517" },
  { value: "REVIEW", label: "Revisão", color: "#A78BFA" },
  { value: "RECORDING", label: "Gravação", color: "#1D9E75" },
  { value: "DELIVERY", label: "Entrega", color: "#FBBF24" },
  { value: "DONE", label: "Concluído", color: "#4ade80" },
];

const PAUSED: DubbingProjectStatus = "PAUSED";

function getStepIndex(status: DubbingProjectStatus): number {
  return STATUS_STEPS.findIndex((s) => s.value === status);
}

function deadlineHint(deadlineIso: string | null | undefined): {
  label: string | null;
  color: string;
} {
  if (!deadlineIso) return { label: null, color: "#505050" };
  const d = new Date(deadlineIso + (deadlineIso.includes("T") ? "" : "T12:00:00"));
  if (Number.isNaN(d.getTime())) return { label: null, color: "#505050" };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dd = new Date(d);
  dd.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((dd.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) {
    return {
      label: `${Math.abs(diffDays)}d atrasado`,
      color: "#F09595",
    };
  }
  if (diffDays === 0) {
    return { label: "vence hoje", color: "#EF9F27" };
  }
  if (diffDays <= 7) {
    return { label: `${diffDays}d restantes`, color: "#EF9F27" };
  }
  return { label: `${diffDays}d restantes`, color: "#505050" };
}

type Props = {
  currentStatus: DubbingProjectStatus;
  deadline?: string | null;
  onChange: (s: DubbingProjectStatus) => void;
};

export function ProjectStatusStepper({
  currentStatus,
  deadline,
  onChange,
}: Props) {
  const isPaused = currentStatus === PAUSED;
  const activeIndex = isPaused ? -1 : getStepIndex(currentStatus);
  const totalSeg = Math.max(1, STATUS_STEPS.length - 1);
  const pct =
    isPaused || activeIndex < 0
      ? 0
      : Math.round((activeIndex / totalSeg) * 100);

  const { label: deadlineLabel, color: deadlineColor } =
    deadlineHint(deadline);

  if (currentStatus === "DONE") {
    return (
      <div className="flex items-center gap-[12px] rounded-[10px] border border-[#0F6E56] bg-[#0d3d2a] px-[16px] py-[14px]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="#1D9E75"
            strokeWidth="1.5"
          />
          <path
            d="M7 12l3.5 3.5L17 8"
            stroke="#5DCAA5"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-[600] text-[#5DCAA5]">
            Projeto concluído!
          </div>
          <div className="mt-[2px] text-[11px] text-[#1D9E75]">
            Todas as etapas foram completadas.
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange("RECORDING")}
          className="shrink-0 text-[10px] text-[#1D9E75] underline transition-colors hover:text-[#5DCAA5]"
        >
          Reabrir
        </button>
      </div>
    );
  }

  if (isPaused) {
    return (
      <div className="flex flex-wrap items-center gap-[12px] rounded-[10px] border border-[#3d2e0d] bg-[#1a1a1a] px-[16px] py-[14px]">
        <div className="h-[8px] w-[8px] shrink-0 rounded-full bg-[#555]" />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-[600] text-[#909090]">
            Projeto pausado
          </div>
          <div className="mt-[2px] text-[10px] text-[#505050]">
            Selecione uma fase para retomar
          </div>
        </div>
        <div className="flex flex-wrap gap-[4px]">
          {STATUS_STEPS.filter((s) => s.value !== "DONE").map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => onChange(s.value)}
              className="rounded-[99px] border border-[#2e2e2e] px-[8px] py-[2px] text-[10px] text-[#606060] transition-colors hover:border-[#404040] hover:text-[#909090]"
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const activeColor =
    activeIndex >= 0 ? STATUS_STEPS[activeIndex]?.color : "#1D9E75";

  return (
    <div className="overflow-hidden rounded-[10px] border border-[#252525] bg-[#1a1a1a]">
      <div className="flex items-center justify-between border-b border-[#252525] px-[16px] py-[10px]">
        <span className="text-[10px] font-[600] uppercase tracking-[0.07em] text-[#505050]">
          Progresso do projeto
        </span>
        <div className="flex min-w-0 items-center gap-[6px]">
          {activeIndex >= 0 && activeColor ? (
            <>
              <div
                className="relative h-[7px] w-[7px] shrink-0 rounded-full"
                style={{ background: activeColor }}
              >
                <div
                  className="absolute inset-0 animate-ping rounded-full opacity-40"
                  style={{ background: activeColor }}
                />
              </div>
              <span
                className="truncate text-[12px] font-[600]"
                style={{ color: activeColor }}
              >
                {STATUS_STEPS[activeIndex]?.label} — fase {activeIndex + 1} de{" "}
                {STATUS_STEPS.length}
              </span>
            </>
          ) : null}
        </div>
      </div>

      <div className="px-[12px] pb-[12px] pt-[16px] sm:px-[16px]">
        <div className="flex justify-between gap-0">
          {STATUS_STEPS.map((step, i) => {
            const isDone = i < activeIndex;
            const isActive = i === activeIndex;

            return (
              <div
                key={step.value}
                className="relative z-10 flex w-0 min-w-0 flex-1 flex-col items-center"
              >
                <button
                  type="button"
                  onClick={() => onChange(step.value)}
                  title={`Definir fase: ${step.label}`}
                  className="flex h-[28px] w-[28px] shrink-0 items-center justify-center rounded-full text-[11px] font-[700] transition-all"
                  style={
                    isDone
                      ? {
                          background: "#0d3d2a",
                          border: "1.5px solid #1D9E75",
                          color: "#5DCAA5",
                        }
                      : isActive
                        ? {
                            background: `${step.color}20`,
                            border: `2px solid ${step.color}`,
                            color: step.color,
                            boxShadow: `0 0 0 4px ${step.color}18`,
                          }
                        : {
                            background: "#141414",
                            border: "1.5px solid #252525",
                            color: "#404040",
                          }
                  }
                >
                  {isDone ? (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M3 8l3.5 3.5L13 4"
                        stroke="#5DCAA5"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </button>
                <span
                  className="mt-[6px] max-w-[72px] text-center text-[9px] font-[500] leading-tight sm:max-w-none sm:text-[10px]"
                  style={
                    isDone
                      ? { color: "#5DCAA5" }
                      : isActive
                        ? { color: step.color, fontWeight: 600 }
                        : { color: "#404040" }
                  }
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        <div className="mt-[14px] flex flex-wrap items-center gap-[10px] border-t border-[#1e1e1e] pt-[10px]">
          <span className="whitespace-nowrap text-[11px] text-[#505050]">
            <span className="font-[500] text-[#5DCAA5]">{pct}%</span> concluído
          </span>
          <div className="h-[3px] min-w-[80px] flex-1 overflow-hidden rounded-full bg-[#252525]">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${pct}%`,
                background: "linear-gradient(90deg, #1D9E75, #5B9BD5)",
              }}
            />
          </div>
          {deadlineLabel ? (
            <span
              className="whitespace-nowrap text-[10px]"
              style={{ color: deadlineColor }}
            >
              prazo · {deadlineLabel}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => onChange(PAUSED)}
            className="whitespace-nowrap text-[10px] text-[#444] transition-colors hover:text-[#909090]"
          >
            Pausar
          </button>
        </div>
      </div>
    </div>
  );
}
