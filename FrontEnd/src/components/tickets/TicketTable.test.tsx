import { act, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { Ticket } from "../../api/types";
import { markTicketSeen } from "../../lib/seen";
import { ALICE, renderPage } from "../../test/utils";
import { TicketTable } from "./TicketTable";

const ticket = (id: number, updated_at: string): Ticket => ({
  id,
  project_id: 1,
  title: `Ticket ${id}`,
  description: "",
  category: "Problème",
  priority: "normal",
  status: "new",
  created_by: { id: 1, username: "admin" },
  assignee: null,
  created_at: "2026-09-01T08:00:00Z",
  updated_at,
  closed_at: null,
});

const isMarked = (id: number) =>
  within(screen.getByRole("link", { name: new RegExp(`Ticket ${id}$`) })).queryByText(
    "Nouveau :",
  ) !== null;

describe("TicketTable", () => {
  it("signale les tickets modifiés depuis ma dernière visite", () => {
    localStorage.setItem(
      `elticketo.seen.${ALICE.id}`,
      JSON.stringify({ since: "2026-10-01T00:00:00Z", tickets: { 7: "2026-10-20T08:00:00Z" } }),
    );
    const tickets = [
      ticket(7, "2026-10-21T09:00:00.123456Z"), // vu, modifié depuis
      ticket(8, "2026-09-30T09:00:00Z"), // inchangé depuis la première visite
      ticket(9, "2026-10-15T09:00:00Z"), // jamais ouvert, modifié depuis la première visite
    ];
    renderPage(<TicketTable tickets={tickets} />, { path: "/" });

    expect([7, 8, 9].map(isMarked)).toEqual([true, false, true]);

    act(() => markTicketSeen(ALICE.id, tickets[0]));
    expect(isMarked(7)).toBe(false);
  });

  it("à la première visite, rien n'est signalé", () => {
    renderPage(<TicketTable tickets={[ticket(7, "2026-10-21T09:00:00Z")]} />, { path: "/" });

    expect(isMarked(7)).toBe(false);
    expect(localStorage.getItem(`elticketo.seen.${ALICE.id}`)).toContain('"since"');
  });
});
