type ProjectsHeaderProps = {
  projectCount: number;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onNewProject: () => void;
};

export function ProjectsHeader({
  projectCount,
  searchQuery,
  onSearchChange,
  onNewProject,
}: ProjectsHeaderProps) {
  return (
    <div className="flex h-[56px] shrink-0 items-center gap-[12px] border-b border-[#222] bg-[#141414] px-[32px]">
      <span className="text-[18px] font-[600] text-[#e8e8e8]">Projetos</span>
      <span className="text-[13px] text-[#404040]">· {projectCount}</span>
      <div className="w-[12px]" aria-hidden />
      <div className="flex w-[280px] shrink-0 items-center gap-[8px] rounded-[7px] border border-[#252525] bg-[#111] px-[12px] py-[7px]">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#404040"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          className="w-full bg-transparent text-[12px] text-[#e8e8e8] outline-none placeholder:text-[#404040]"
          placeholder="Buscar por nome ou cliente..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Buscar projetos"
        />
        {searchQuery ? (
          <button
            type="button"
            onClick={() => onSearchChange("")}
            className="text-[16px] leading-none text-[#404040] hover:text-[#909090]"
            aria-label="Limpar busca"
          >
            ×
          </button>
        ) : null}
      </div>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onNewProject}
        className="flex items-center gap-[6px] rounded-[7px] border border-[#0F6E56] bg-[#1D9E75] px-[18px] py-[8px] text-[12px] font-[500] text-white transition-colors hover:bg-[#0F6E56]"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden
        >
          <path
            d="M8 2v12M2 8h12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        Novo projeto
      </button>
    </div>
  );
}
