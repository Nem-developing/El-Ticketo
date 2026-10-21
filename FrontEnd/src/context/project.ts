import { createContext, useContext } from "react";

import type { Project } from "../api/types";

export interface ProjectContextValue {
  projects: Project[];
  current: Project | null;
  select: (projectId: number) => void;
}

export const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProjectContext(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) throw new Error("useProjectContext doit être utilisé dans <ProjectProvider>.");
  return context;
}

/** Projet sélectionné — garanti non nul sous <ProjectProvider>. */
export function useCurrentProject(): Project {
  const { current } = useProjectContext();
  if (!current) throw new Error("Aucun projet sélectionné.");
  return current;
}
