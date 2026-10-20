import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Link } from "react-router";
import { describe, expect, it } from "vitest";

import { jsonResponse, mockFetch, renderPage } from "../test/utils";
import { TicketsPage } from "./TicketsPage";

function lastTicketsQuery(fetchMock: ReturnType<typeof mockFetch>) {
  const urls = fetchMock.mock.calls.map(([input]) => new URL(String(input), "http://localhost"));
  return urls.filter((url) => url.pathname === "/api/tickets").at(-1)!.searchParams;
}

describe("TicketsPage", () => {
  it("reprend la recherche de l'URL et filtre sur le projet courant", async () => {
    const fetchMock = mockFetch(() => jsonResponse([]));
    renderPage(<TicketsPage />, { path: "/tickets", route: "/tickets?q=wifi" });

    expect(screen.getByLabelText("Rechercher un ticket")).toHaveValue("wifi");
    await screen.findByText("Aucun ticket ne correspond à la recherche");
    const query = lastTicketsQuery(fetchMock);
    expect(query.get("q")).toBe("wifi");
    expect(query.get("project_id")).toBe("1");
    expect(query.getAll("status")).toEqual(["new", "in_progress", "waiting"]);
  });

  it("reporte la saisie dans l'URL après une pause", async () => {
    mockFetch(() => jsonResponse([]));
    renderPage(<TicketsPage />, { path: "/tickets" });

    await userEvent.type(screen.getByLabelText("Rechercher un ticket"), "vpn ");
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent("/tickets?q=vpn+"),
    );
    // L'espace final est conservé dans le champ (pas de « saut » du curseur).
    expect(screen.getByLabelText("Rechercher un ticket")).toHaveValue("vpn ");
  });

  it("vide le champ quand on navigue vers une vue sans recherche", async () => {
    mockFetch(() => jsonResponse([]));
    renderPage(<TicketsPage />, {
      path: "/tickets",
      route: "/tickets?q=wifi",
      extra: <Link to="/tickets?view=mine">Lien Mes tickets</Link>,
    });

    await userEvent.click(screen.getByText("Lien Mes tickets"));

    expect(screen.getByLabelText("Rechercher un ticket")).toHaveValue("");
    // La recherche abandonnée ne doit pas réapparaître dans l'URL.
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(screen.getByTestId("location")).toHaveTextContent("/tickets?view=mine");
    expect(screen.getByRole("button", { name: "Mes tickets" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
