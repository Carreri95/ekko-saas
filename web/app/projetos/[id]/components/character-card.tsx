"use client";

import type { ProjectCharacterDto } from "@/app/types/project-character";

const IMPORTANCE_LABEL: Record<string, string> = {
  MAIN: "Principal",
  SUPPORT: "Suporte",
  EXTRA: "Figurante",
};

const IMPORTANCE_STYLE: Record<string, { bg: string; border: string; text: string }> = {
  MAIN: { bg: "rgba(29,158,117,0.12)", border: "#1D9E75", text: "#5DCAA5" },
  SUPPORT: { bg: "#1e1e1e", border: "#2e2e2e", text: "#606060" },
  EXTRA: { bg: "#141414", border: "#252525", text: "#444" },
};

function avatarColor(name: string): { bg: string; color: string } {
  const colors = [
    { bg: "#0d3d2a", color: "#5DCAA5" },
    { bg: "#0d1f3d", color: "#93C5FD" },
    { bg: "#1e1a0d", color: "#FDE68A" },
    { bg: "#1e0d3d", color: "#C4B5FD" },
    { bg: "#2a0a0a", color: "#F09595" },
  ];
  return colors[(name.charCodeAt(0) || 0) % colors.length];
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (parts.length === 0) return "?";
  return parts.map((n) => n[0]!.toUpperCase()).join("");
}

type Props = {
  character: ProjectCharacterDto;
  onEdit: (c: ProjectCharacterDto) => void;
};

export function CharacterCard({ character, onEdit }: Props) {
  const imp = IMPORTANCE_STYLE[character.importance] ?? IMPORTANCE_STYLE.SUPPORT;
  const dubber = character.castMember;

  return (
    <div
      className="flex cursor-pointer flex-col gap-[8px] rounded-[8px] border bg-[#1a1a1a] p-[12px] transition-colors hover:border-[#333]"
      style={{ borderColor: dubber ? "#252525" : "#3d2e0d" }}
      onClick={() => onEdit(character)}
    >
      <div className="flex items-start justify-between gap-[6px]">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-[600] text-[#e8e8e8]">{character.name}</div>
          <div className="mt-[1px] text-[10px] text-[#606060]">
            {[character.type, character.voiceType].filter(Boolean).join(" · ") || "Sem tipo definido"}
          </div>
        </div>
        <span
          className="flex-shrink-0 rounded-[99px] px-[7px] py-[1px] text-[10px] font-[500]"
          style={{
            background: imp.bg,
            border: `0.5px solid ${imp.border}`,
            color: imp.text,
          }}
        >
          {IMPORTANCE_LABEL[character.importance]}
        </span>
      </div>

      <div className="h-px bg-[#252525]" />

      {dubber ? (
        <div className="flex items-center justify-between gap-[6px]">
          <div className="flex items-center gap-[6px]">
            <div
              className="flex h-[22px] w-[22px] flex-shrink-0 items-center justify-center rounded-full text-[9px] font-[700]"
              style={avatarColor(dubber.name)}
            >
              {getInitials(dubber.name)}
            </div>
            <div>
              <div className="text-[11px] text-[#909090]">{dubber.name}</div>
              <div className="text-[9px] text-[#404040]">Escalado</div>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(character);
            }}
            className="rounded-[3px] border border-[#2e2e2e] bg-transparent px-[6px] py-[1px] text-[9px] text-[#505050] transition-colors hover:bg-[#252525] hover:text-[#909090]"
          >
            Trocar
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-[5px] text-[11px] text-[#505050]">
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span style={{ color: "#EF9F27" }}>Sem dublador escalado</span>
        </div>
      )}
    </div>
  );
}
