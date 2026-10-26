import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactElement } from "react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { vi } from "vitest";

import type { Project, User } from "../api/types";
import { AuthContext, type AuthContextValue } from "../auth/context";
import { ProjectContext } from "../context/project";
import { ToastProvider } from "../context/ToastProvider";

export const ALICE: User = {
  id: 2,
  username: "alice",
  is_admin: false,
  is_active: true,
  sso: false,
  created_at: "2026-10-01T08:00:00Z",
};

export const PROJECT: Project = {
  id: 1,
  name: "Support",
  description: "",
  created_at: "2026-10-01T08:00:00Z",
};

/** Réponse JSON simulée pour `fetch`. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Remplace `fetch` ; `handler` reçoit la méthode et l'URL (chemin + query). */
export function mockFetch(handler: (method: string, url: URL) => Response | Promise<Response>) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input), "http://localhost");
    return handler(init?.method ?? "GET", url);
  });
}

/** Affiche l'URL courante, pour vérifier les navigations. */
export function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

interface RenderOptions {
  path: string;
  route?: string;
  user?: User | null;
  auth?: Partial<AuthContextValue>;
  /** Éléments affichés à côté de la page (ex. liens de navigation). */
  extra?: ReactElement;
}

/** Rend une page avec les fournisseurs de l'application (session et projet simulés). */
export function renderPage(
  element: ReactElement,
  { path, route = path, user = ALICE, auth, extra }: RenderOptions,
) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const authValue: AuthContextValue = {
    user,
    isLoading: false,
    sessionError: null,
    retrySession: vi.fn(),
    login: vi.fn(),
    loginWithToken: vi.fn(),
    logout: vi.fn(),
    ...auth,
  };
  const projectValue = { projects: [PROJECT], current: PROJECT, select: vi.fn() };

  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthContext.Provider value={authValue}>
          <ProjectContext.Provider value={projectValue}>
            <MemoryRouter initialEntries={[route]}>
              <Routes>
                <Route path={path.split("?")[0]} element={element} />
                <Route path="*" element={null} />
              </Routes>
              <LocationProbe />
              {extra}
            </MemoryRouter>
          </ProjectContext.Provider>
        </AuthContext.Provider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}
