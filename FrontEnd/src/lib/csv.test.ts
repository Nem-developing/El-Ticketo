import { describe, expect, it } from "vitest";

import type { Ticket } from "../api/types";
import { ticketsToCsv } from "./csv";

const TICKET: Ticket = {
  id: 7,
  project_id: 1,
  title: 'Écran "noir"; urgent',
  description: "Ligne 1\nLigne 2",
  category: "=Matériel",
  priority: "high",
  status: "in_progress",
  created_by: { id: 1, username: "admin" },
  assignee: null,
  created_at: "2026-10-20T08:00:00Z",
  updated_at: "2026-10-20T08:00:00Z",
  closed_at: null,
};

describe("ticketsToCsv", () => {
  it("produit un CSV lisible par Excel, champs délicats protégés", () => {
    const [header, row] = ticketsToCsv([TICKET]).split("\r\n");

    expect(header).toMatch(/^\uFEFFN°;Titre;Statut;/);
    expect(row).toContain('7;"Écran ""noir""; urgent";En cours;Haute;\'=Matériel;;admin;');
    expect(row).toMatch(/;"Ligne 1\nLigne 2"$/);
  });
});
