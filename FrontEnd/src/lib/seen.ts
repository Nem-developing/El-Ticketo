import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";

import type { Ticket } from "../api/types";
import { useCurrentUser } from "../auth/context";
import { readStorage, writeStorage } from "./storage";

// Version de chaque ticket vue en dernier, dans ce navigateur : une ligne modifiée depuis est
// signalée. Ce qui n'a pas bougé depuis la toute première visite compte comme vu.
interface Seen {
  since: string | null;
  tickets: Record<string, string>;
}

const MAX_TICKETS = 1000;
const listeners = new Set<() => void>();

const storageKey = (userId: number) => `elticketo.seen.${userId}`;

function parse(raw: string | null): Seen {
  try {
    if (raw) return JSON.parse(raw) as Seen;
  } catch {
    // Valeur illisible : on repart de zéro.
  }
  return { since: null, tickets: {} };
}

function write(userId: number, seen: Seen) {
  writeStorage(storageKey(userId), JSON.stringify(seen));
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

const isAfter = (date: string, reference: string) => Date.parse(date) > Date.parse(reference);

export function markTicketSeen(userId: number, ticket: Ticket) {
  const seen = parse(readStorage(storageKey(userId)));
  if (seen.tickets[ticket.id] === ticket.updated_at) return;
  const tickets: Record<string, string> = { ...seen.tickets, [ticket.id]: ticket.updated_at };
  let entries = Object.entries(tickets);
  if (entries.length > MAX_TICKETS) {
    entries = entries.sort(([, a], [, b]) => Date.parse(b) - Date.parse(a)).slice(0, MAX_TICKETS);
  }
  write(userId, {
    since: seen.since ?? new Date().toISOString(),
    tickets: Object.fromEntries(entries),
  });
}

/** Indique si un ticket a été modifié depuis la dernière fois que je l'ai ouvert. */
export function useIsUnread(): (ticket: Ticket) => boolean {
  const user = useCurrentUser();
  const raw = useSyncExternalStore(subscribe, () => readStorage(storageKey(user.id)));
  const seen = useMemo(() => parse(raw), [raw]);

  useEffect(() => {
    if (seen.since === null) write(user.id, { since: new Date().toISOString(), tickets: {} });
  }, [seen.since, user.id]);

  return useCallback(
    (ticket: Ticket) => {
      const reference = seen.tickets[ticket.id] ?? seen.since;
      return reference !== null && isAfter(ticket.updated_at, reference);
    },
    [seen],
  );
}
