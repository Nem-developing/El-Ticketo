import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { describe, expect, it } from "vitest";

import { TOKEN_KEY, tokenStorage } from "../api/client";
import { ToastProvider } from "../context/ToastProvider";
import { LoginPage } from "../pages/LoginPage";
import { ALICE, jsonResponse, LocationProbe, mockFetch } from "../test/utils";
import { AuthProvider } from "./AuthProvider";
import { RequireAuth } from "./guards";

function renderApp(route: string) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<RequireAuth />}>
                <Route path="/tickets/:id" element={<p>Ticket protégé</p>} />
              </Route>
            </Routes>
            <LocationProbe />
          </MemoryRouter>
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

async function fillLogin(password: string) {
  await userEvent.type(screen.getByLabelText("Identifiant"), "alice");
  await userEvent.type(screen.getByLabelText("Mot de passe"), password);
  await userEvent.click(screen.getByRole("button", { name: "Se connecter" }));
}

describe("session", () => {
  it("redirige vers la connexion puis revient sur la page demandée", async () => {
    mockFetch((method, url) => {
      if (method === "POST" && url.pathname === "/api/auth/login") {
        return jsonResponse({
          access_token: "t0k3n",
          expires_at: "2026-10-27T00:00:00Z",
          user: ALICE,
        });
      }
      return jsonResponse({ detail: "inattendu" }, 500);
    });
    renderApp("/tickets/52");
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/login"));

    await fillLogin("bon-mot-de-passe");

    expect(await screen.findByText("Ticket protégé")).toBeInTheDocument();
    expect(screen.getByTestId("location")).toHaveTextContent("/tickets/52");
    expect(tokenStorage.get()).toBe("t0k3n");
  });

  it("affiche l'erreur renvoyée par l'API", async () => {
    mockFetch(() => jsonResponse({ detail: "Identifiants incorrects." }, 401));
    renderApp("/login");
    await fillLogin("mauvais");
    expect(await screen.findByRole("alert")).toHaveTextContent("Identifiants incorrects.");
  });

  it("une session expirée ramène à la connexion avec un message", async () => {
    tokenStorage.set("expire");
    mockFetch(() => jsonResponse({ detail: "Session invalide ou expirée." }, 401));
    renderApp("/tickets/52");

    expect(
      await screen.findByText("Votre session a expiré, reconnectez-vous."),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/login"));
    expect(tokenStorage.get()).toBeNull();
  });

  it("garde la session si le serveur est momentanément injoignable", async () => {
    tokenStorage.set("valide");
    mockFetch(() => jsonResponse({ detail: "Erreur" }, 503));
    renderApp("/tickets/52");

    expect(await screen.findByRole("button", { name: "Réessayer" })).toBeInTheDocument();
    expect(tokenStorage.get()).toBe("valide");
  });

  it("suit une déconnexion faite dans un autre onglet", async () => {
    tokenStorage.set("partage");
    mockFetch(() => jsonResponse(ALICE));
    renderApp("/tickets/52");
    expect(await screen.findByText("Ticket protégé")).toBeInTheDocument();

    act(() => {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new StorageEvent("storage", { key: TOKEN_KEY, newValue: null }));
    });

    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/login"));
  });
});
