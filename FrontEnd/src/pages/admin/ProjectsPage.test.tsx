import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ALICE, jsonResponse, mockFetch, PROJECT, renderPage } from "../../test/utils";
import { ProjectsPage } from "./ProjectsPage";

describe("ProjectsPage", () => {
  it("enregistre les catégories du projet, une par ligne", async () => {
    const sent: unknown[] = [];
    const fetchMock = mockFetch(async (method) => {
      if (method === "PATCH") {
        sent.push(JSON.parse(String(fetchMock.mock.lastCall![1]!.body)));
        return jsonResponse(PROJECT);
      }
      return jsonResponse([PROJECT]);
    });
    renderPage(<ProjectsPage />, { path: "/admin/projects", user: { ...ALICE, is_admin: true } });

    await userEvent.click(await screen.findByRole("button", { name: "Modifier" }));
    const field = screen.getByLabelText("Catégories");
    expect(field).toHaveValue("Support technique\nBug");
    await userEvent.clear(field);
    await userEvent.type(field, " Wifi {enter}{enter}VPN");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() =>
      expect(sent).toEqual([{ name: "Support", description: "", categories: ["Wifi", "VPN"] }]),
    );
  });
});
