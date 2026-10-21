import { act, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { jsonResponse, mockFetch, renderPage } from "../test/utils";
import { NewTicketPage } from "./NewTicketPage";

/** Collage simulé : jsdom ne sait pas construire un vrai presse-papiers. */
function paste(target: Element, clipboardData: { files: File[]; types: string[] }) {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  Object.defineProperty(event, "clipboardData", { value: clipboardData });
  act(() => target.dispatchEvent(event));
}

describe("NewTicketPage", () => {
  afterEach(() => localStorage.clear());

  it("se pré-remplit depuis un lien", () => {
    mockFetch(() => jsonResponse([]));
    renderPage(<NewTicketPage />, {
      path: "/tickets/new",
      route: "/tickets/new?title=VPN%20coup%C3%A9&category=R%C3%A9seau&priority=high",
    });

    expect(screen.getByLabelText("Titre")).toHaveValue("VPN coupé");
    expect(screen.getByLabelText("Préciser la catégorie")).toHaveValue("Réseau");
    expect(screen.getByLabelText("Haute")).toBeChecked();
  });

  it("garde le brouillon d'un ticket non envoyé", async () => {
    mockFetch(() => jsonResponse([]));
    const first = renderPage(<NewTicketPage />, { path: "/tickets/new" });
    await userEvent.type(screen.getByLabelText("Titre"), "Imprimante");
    first.unmount();

    renderPage(<NewTicketPage />, { path: "/tickets/new" });
    expect(screen.getByLabelText("Titre")).toHaveValue("Imprimante");
  });

  it("joint une capture collée, mais laisse coller du texte dans un champ", () => {
    mockFetch(() => jsonResponse([]));
    renderPage(<NewTicketPage />, { path: "/tickets/new" });
    const capture = new File(["png"], "capture.png", { type: "image/png" });

    // Une copie depuis Excel contient du texte et une image : le texte l'emporte.
    paste(screen.getByLabelText("Titre"), { files: [capture], types: ["text/plain", "Files"] });
    expect(screen.queryByText("capture.png")).not.toBeInTheDocument();

    paste(document.body, { files: [capture], types: ["Files"] });
    expect(screen.getByText("capture.png")).toBeInTheDocument();
  });
});
