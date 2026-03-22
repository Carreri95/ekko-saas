/** Projetos na listagem (tabela). */
export const PROJECTS_PAGE_SIZE = 8;

export const PROJECT_STATUS_FILTERS = [
  { label: "Todos", value: "" },
  { label: "Spotting", value: "SPOTTING" },
  { label: "Adaptação", value: "ADAPTATION" },
  { label: "Revisão", value: "REVIEW" },
  { label: "Em gravação", value: "RECORDING" },
  { label: "Entrega", value: "DELIVERY" },
  { label: "Concluído", value: "DONE" },
  { label: "Pausado", value: "PAUSED" },
] as const;
