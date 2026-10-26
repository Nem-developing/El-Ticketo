import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import type { TicketNotification } from "../../api/types";
import { jsonResponse, mockFetch, renderPage } from "../../test/utils";
import { Notifications } from "./Notifications";

const notification = (id: number, is_read: boolean): TicketNotification => ({
  id,
  kind: id === 1 ? "mention" : "assignment",
  ticket: { id: 40 + id, title: `Ticket ${id}` },
  actor: { id: 1, username: "admin" },
  is_read,
  created_at: "2026-10-20T09:00:00Z",
});

describe("Notifications", () => {
  it("compte les non lues, les liste et les marque toutes comme lues", async () => {
    let allRead = false;
    const fetchMock = mockFetch((method) => {
      if (method === "POST") {
        allRead = true;
        return jsonResponse(null, 204);
      }
      return jsonResponse([
        notification(1, allRead),
        notification(2, allRead),
        notification(3, true),
      ]);
    });
    renderPage(<Notifications />, { path: "/" });

    const bell = await screen.findByRole("button", { name: "Notifications (2 non lues)" });
    await waitFor(() => expect(document.title).toBe("(2) El Ticketo"));
    await userEvent.click(bell);

    const mention = screen.getByRole("link", { name: /^admin vous a mentionné.*non lue.*#41/ });
    expect(mention).toHaveAttribute("href", "/tickets/41");
    expect(screen.getByRole("link", { name: /^admin vous a assigné.*non lue/ })).toBeVisible();
    expect(screen.getByRole("link", { name: /^admin vous a assigné\s*#43/ })).toBeVisible();

    await userEvent.click(screen.getByRole("button", { name: "Tout marquer comme lu" }));
    expect(await screen.findByRole("button", { name: "Notifications" })).toBeInTheDocument();
    const posted = fetchMock.mock.calls.filter(([, init]) => init?.method === "POST");
    expect(posted.map(([input]) => String(input))).toEqual(["/api/notifications/read"]);
  });

  it("explique à quoi elle sert tant qu'elle est vide", async () => {
    mockFetch(() => jsonResponse([]));
    renderPage(<Notifications />, { path: "/" });

    await userEvent.click(screen.getByRole("button", { name: "Notifications" }));
    expect(await screen.findByText(/quand quelqu'un vous mentionne \(@alice\)/)).toBeVisible();
  });
});
