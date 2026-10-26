import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { jsonResponse, mockFetch, renderPage } from "../test/utils";
import { LoginPage } from "./LoginPage";

describe("LoginPage", () => {
  it("propose le SSO, en revenant ensuite sur la page demandée", async () => {
    mockFetch(() => jsonResponse({ enabled: true }));
    renderPage(<LoginPage />, { path: "/login", user: null });

    const sso = await screen.findByRole("link", { name: "Se connecter avec le SSO" });
    expect(sso).toHaveAttribute("href", "/api/auth/sso/login?next=%2F");
  });

  it("n'affiche pas le SSO quand il n'est pas configuré", async () => {
    const fetchMock = mockFetch(() => jsonResponse({ enabled: false }));
    renderPage(<LoginPage />, { path: "/login", user: null });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByText("Se connecter avec le SSO")).not.toBeInTheDocument();
  });

  it("au retour du SSO, ouvre la session et retire le token de l'adresse", async () => {
    mockFetch(() => jsonResponse({ enabled: true }));
    const loginWithToken = vi.fn();
    renderPage(<LoginPage />, {
      path: "/login",
      route: "/login#token=abc&next=%2Ftickets%2F3",
      user: null,
      auth: { loginWithToken },
    });

    await waitFor(() => expect(loginWithToken).toHaveBeenCalledWith("abc"));
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/login$/);
  });

  it("affiche l'erreur renvoyée par le SSO", async () => {
    mockFetch(() => jsonResponse({ enabled: true }));
    renderPage(<LoginPage />, {
      path: "/login",
      route: "/login#error=Le%20compte%20%C2%AB%20bob%20%C2%BB%20est%20d%C3%A9sactiv%C3%A9.",
      user: null,
    });

    expect(await screen.findByRole("alert")).toHaveTextContent("Le compte « bob » est désactivé.");
  });
});
