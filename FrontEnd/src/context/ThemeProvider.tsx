import { useEffect, useMemo, useState, type ReactNode } from "react";

import { readStorage, writeStorage } from "../lib/storage";
import { ThemeContext, type ThemePreference } from "./theme";

const STORAGE_KEY = "elticketo.theme";

function readPreference(): ThemePreference {
  const stored = readStorage(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

/** "system" suit le réglage de l'OS ; "light" / "dark" le forcent via `data-theme`. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreference] = useState<ThemePreference>(readPreference);

  useEffect(() => {
    const root = document.documentElement;
    if (preference === "system") delete root.dataset.theme;
    else root.dataset.theme = preference;
    writeStorage(STORAGE_KEY, preference);
  }, [preference]);

  const value = useMemo(() => ({ preference, setPreference }), [preference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
