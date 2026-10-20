import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";

import { ProjectProvider } from "../../context/ProjectProvider";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppLayout() {
  const location = useLocation();
  // Sur mobile, le menu n'est ouvert que pour la page courante : naviguer le referme.
  const [menuOpenedAt, setMenuOpenedAt] = useState<string | null>(null);
  const menuOpen = menuOpenedAt === location.key;
  const setMenuOpen = (open: boolean) => setMenuOpenedAt(open ? location.key : null);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpenedAt(null);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  return (
    <ProjectProvider>
      <div className={`app ${menuOpen ? "app--menu-open" : ""}`}>
        <Sidebar />
        <div className="app__backdrop" onClick={() => setMenuOpen(false)} aria-hidden="true" />
        <div className="app__main">
          <Topbar menuOpen={menuOpen} onToggleMenu={() => setMenuOpen(!menuOpen)} />
          <main className="app__content">
            {/* Changer de page réinitialise l'affichage d'erreur. */}
            <ErrorBoundary key={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </ProjectProvider>
  );
}
