import { describe, expect, it } from "vitest";

import type { TicketEvent } from "../api/types";
import { describeEvent } from "./labels";

const event = (field: TicketEvent["field"], value: string | null): TicketEvent => ({
  id: 1,
  actor: { id: 2, username: "alice" },
  field,
  value,
  created_at: "2026-10-20T08:00:00Z",
});

describe("describeEvent", () => {
  it.each([
    [event("status", "in_progress"), "a passé le statut à « En cours »"],
    [event("assignee", "alice"), "s'est assigné le ticket"],
    [event("assignee", "bob"), "a assigné le ticket à bob"],
    [event("assignee", null), "a retiré l'assignation"],
    [event("description", null), "a modifié la description"],
  ])("%o → %s", (input, expected) => {
    expect(describeEvent(input)).toBe(expected);
  });
});
