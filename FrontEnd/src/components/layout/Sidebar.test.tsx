import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ALICE, jsonResponse, mockFetch, renderPage } from "../../test/utils";
import { Sidebar } from "./Sidebar";

const ADMIN = { ...ALICE, is_admin: true };

describe("Sidebar", () => {
  it("dans l'application, ne montre que les tickets et un accès à l'administration", () => {
    mockFetch(() => jsonResponse({ version: "dev" }));
    renderPage(<Sidebar />, { path: "/tickets", user: ADMIN });

    expect(screen.getByRole("link", { name: "Mes tickets" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Administration" })).toHaveAttribute("href", "/admin");
    expect(screen.queryByRole("link", { name: "Utilisateurs" })).not.toBeInTheDocument();
  });

  it("dans l'administration, ne montre que les pages d'administration", () => {
    mockFetch(() => jsonResponse({ version: "dev" }));
    renderPage(<Sidebar />, { path: "/admin/users", user: ADMIN });

    expect(screen.getByRole("link", { name: "Utilisateurs" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Retour aux tickets" })).toHaveAttribute("href", "/");
    expect(screen.queryByRole("link", { name: "Mes tickets" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Nouveau ticket" })).not.toBeInTheDocument();
  });

  it("n'affiche pas l'accès à l'administration aux membres", () => {
    mockFetch(() => jsonResponse({ version: "dev" }));
    renderPage(<Sidebar />, { path: "/", user: ALICE });

    expect(screen.queryByRole("link", { name: "Administration" })).not.toBeInTheDocument();
  });
});
