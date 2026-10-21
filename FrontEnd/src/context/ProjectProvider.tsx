import { useCallback, useMemo, useState, type ReactNode } from "react";

import { useProjects } from "../api/queries";
import { ErrorState, Loader } from "../components/ui/States";
import { readStorage, writeStorage } from "../lib/storage";
import { ProjectContext } from "./project";

const STORAGE_KEY = "elticketo.project";

export function ProjectProvider({ children }: { children: ReactNode }) {
  const projects = useProjects();
  const [selectedId, setSelectedId] = useState(() => Number(readStorage(STORAGE_KEY)) || null);

  const select = useCallback((projectId: number) => {
    setSelectedId(projectId);
    writeStorage(STORAGE_KEY, String(projectId));
  }, []);

  const value = useMemo(() => {
    const list = projects.data ?? [];
    const current = list.find((project) => project.id === selectedId) ?? list[0] ?? null;
    return { projects: list, current, select };
  }, [projects.data, selectedId, select]);

  if (projects.isPending) return <Loader fullscreen />;
  if (projects.isLoadingError) {
    return <ErrorState error={projects.error} onRetry={projects.refetch} fullscreen />;
  }
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}
