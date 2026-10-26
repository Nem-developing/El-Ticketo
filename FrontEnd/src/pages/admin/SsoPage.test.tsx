import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { SsoConfig } from "../../api/types";
import { ALICE, jsonResponse, mockFetch, renderPage } from "../../test/utils";
import { SsoPage } from "./SsoPage";

const ADMIN = { ...ALICE, is_admin: true };
const CONFIG: SsoConfig = {
  enabled: false,
  issuer: "https://idp.exemple.fr",
  client_id: "elticketo",
  has_secret: true,
  redirect_uri: "https://tickets.exemple.fr/api/auth/sso/callback",
};

describe("SsoPage", () => {
  it("garde le secret enregistré quand le champ reste vide", async () => {
    const sent: unknown[] = [];
    const fetchMock = mockFetch(async (method) => {
      if (method === "PUT") {
        sent.push(JSON.parse(String(fetchMock.mock.lastCall![1]!.body)));
        return jsonResponse({ ...CONFIG, enabled: true });
      }
      return jsonResponse(CONFIG);
    });
    renderPage(<SsoPage />, { path: "/admin/sso", user: ADMIN });

    expect(await screen.findByDisplayValue(CONFIG.redirect_uri)).toBeInTheDocument();
    const testButton = screen.getByRole("button", { name: "Tester la connexion" });
    expect(testButton).toBeEnabled();

    await userEvent.click(screen.getByLabelText(/Proposer « Se connecter avec le SSO »/));
    // Une modification non enregistrée ne peut pas être testée.
    expect(testButton).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(sent).toEqual([
        { enabled: true, issuer: CONFIG.issuer, client_id: "elticketo", client_secret: null },
      ]),
    );
  });

  it("affiche le résultat du test au retour du fournisseur", async () => {
    mockFetch(() => jsonResponse(CONFIG));
    renderPage(<SsoPage />, {
      path: "/admin/sso",
      route: "/admin/sso#test=error&message=Jeton%20refus%C3%A9.",
      user: ADMIN,
    });

    expect(await screen.findByText(/Test échoué/)).toHaveTextContent("Test échoué : Jeton refusé.");
    expect(screen.getByTestId("location")).toHaveTextContent(/^\/admin\/sso$/);
  });
});
