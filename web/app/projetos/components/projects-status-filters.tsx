import { PROJECT_STATUS_FILTERS } from "../constants";

type ProjectsStatusFiltersProps = {
  value: string;
  onChange: (value: string) => void;
};

export function ProjectsStatusFilters({
  value,
  onChange,
}: ProjectsStatusFiltersProps) {
  return (
    <div className="projects-filters">
      <span className="projects-filters-label">Status:</span>
      {PROJECT_STATUS_FILTERS.map((f) => (
        <button
          key={f.value || "all"}
          type="button"
          onClick={() => onChange(f.value)}
          className={`projects-filter-chip${value === f.value ? " active" : ""}`}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}
