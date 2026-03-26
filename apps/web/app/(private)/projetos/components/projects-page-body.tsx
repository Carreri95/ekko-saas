import type { ReactNode } from "react";

type ProjectsPageBodyProps = {
  children: ReactNode;
};

export function ProjectsPageBody({ children }: ProjectsPageBodyProps) {
  return (
    <div className="projects-body min-h-0 flex-1 overflow-y-auto">
      <div className="projects-container">{children}</div>
    </div>
  );
}
