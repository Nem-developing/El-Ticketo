import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { Ticket } from "../api/types";
import { ALICE, jsonResponse, mockFetch, renderPage } from "../test/utils";
import { TicketPage } from "./TicketPage";

const TICKET: Ticket = {
  id: 7,
  project_id: 1,
  title: "Imprimante bloquée",
  description: "Bourrage papier",
  category: "Support technique",
  priority: "normal",
  status: "new",
  created_by: { id: 1, username: "admin" },
  assignee: null,
  created_at: "2026-10-20T08:00:00Z",
  updated_at: "2026-10-20T08:00:00Z",
  closed_at: null,
};

const posts: string[] = [];

function mockTicketApi() {
  posts.length = 0;
  const patches: unknown[] = [];
  const fetchMock = mockFetch(async (method, url) => {
    if (method === "POST") {
      posts.push(url.pathname + url.search);
      return jsonResponse({ id: 5 }, 201);
    }
    if (url.pathname === "/api/tickets/7" && method === "PATCH") {
      const body = JSON.parse(String(fetchMock.mock.lastCall![1]!.body));
      patches.push(body);
      return jsonResponse({ ...TICKET, ...body });
    }
    if (url.pathname === "/api/tickets/7") return jsonResponse(TICKET);
    if (url.pathname === "/api/tickets/7/comments") return jsonResponse([]);
    if (url.pathname === "/api/tickets/7/attachments") return jsonResponse([]);
    if (url.pathname === "/api/tickets/7/events") {
      return jsonResponse([
        {
          id: 1,
          actor: { id: ALICE.id, username: "alice" },
          field: "status",
          value: "waiting",
          created_at: "2026-10-20T09:00:00Z",
        },
      ]);
    }
    if (url.pathname === "/api/users") return jsonResponse([ALICE]);
    return jsonResponse({ detail: "Ticket introuvable." }, 404);
  });
  return patches;
}

describe("TicketPage", () => {
  it("n'envoie que les champs réellement modifiés", async () => {
    const patches = mockTicketApi();
    renderPage(<TicketPage />, { path: "/tickets/:ticketId", route: "/tickets/7" });

    await userEvent.click(await screen.findByRole("button", { name: "Modifier" }));
    const category = screen.getByLabelText("Catégorie");
    await userEvent.clear(category);
    await userEvent.type(category, "Matériel");
    await userEvent.click(screen.getByRole("button", { name: "Enregistrer" }));

    await waitFor(() => expect(patches).toEqual([{ category: "Matériel" }]));
  });

  it("affiche l'historique des modifications dans le fil", async () => {
    mockTicketApi();
    renderPage(<TicketPage />, { path: "/tickets/:ticketId", route: "/tickets/7" });

    const event = await screen.findByText("a passé le statut à « En attente »");
    expect(event.closest("li")).toHaveTextContent("alice a passé le statut à « En attente »");
  });

  it("« Prendre en charge » passe le ticket en cours et me l'assigne", async () => {
    const patches = mockTicketApi();
    renderPage(<TicketPage />, { path: "/tickets/:ticketId", route: "/tickets/7" });

    await userEvent.click(await screen.findByRole("button", { name: "Prendre en charge" }));

    await waitFor(() =>
      expect(patches).toEqual([{ status: "in_progress", assignee_id: ALICE.id }]),
    );
  });

  it("joint au commentaire, et non au ticket, la capture collée dans le commentaire", async () => {
    mockTicketApi();
    renderPage(<TicketPage />, { path: "/tickets/:ticketId", route: "/tickets/7" });

    const textarea = await screen.findByLabelText("Nouveau commentaire");
    const capture = new File(["png"], "capture.png", { type: "image/png" });
    fireEvent.paste(textarea, { clipboardData: { files: [capture], types: ["Files"] } });
    expect(await screen.findByText("capture.png")).toBeInTheDocument();
    expect(posts).toEqual([]);

    await userEvent.click(screen.getByRole("button", { name: "Commenter" }));

    await waitFor(() =>
      expect(posts).toEqual([
        "/api/tickets/7/comments",
        "/api/tickets/7/attachments?comment_id=5&name=capture.png",
      ]),
    );
  });

  it.each(["/tickets/0", "/tickets/abc", "/tickets/999"])(
    "%s affiche « Ticket introuvable »",
    async (route) => {
      mockFetch(() => jsonResponse({ detail: "Ticket introuvable." }, 404));
      renderPage(<TicketPage />, { path: "/tickets/:ticketId", route });
      expect(await screen.findByText("Ticket introuvable")).toBeInTheDocument();
    },
  );
});
