import type { Ticket } from "../api/types";
import { PRIORITY_LABELS, STATUS_LABELS } from "./labels";

const dateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

function cell(value: string | number): string {
  let text = String(value);
  // Un tableur exécuterait « =… » comme une formule.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

/** CSV tel qu'Excel l'ouvre en français : séparateur « ; », UTF-8 avec BOM. */
export function ticketsToCsv(tickets: Ticket[]): string {
  const date = (iso: string | null) => (iso ? dateTime.format(new Date(iso)) : "");
  const rows = [
    [
      "N°",
      "Titre",
      "Statut",
      "Priorité",
      "Catégorie",
      "Assigné à",
      "Créé par",
      "Créé le",
      "Fermé le",
      "Description",
    ],
    ...tickets.map((ticket) => [
      ticket.id,
      ticket.title,
      STATUS_LABELS[ticket.status],
      PRIORITY_LABELS[ticket.priority],
      ticket.category,
      ticket.assignee?.username ?? "",
      ticket.created_by.username,
      date(ticket.created_at),
      date(ticket.closed_at),
      ticket.description,
    ]),
  ];
  return "\uFEFF" + rows.map((row) => row.map(cell).join(";")).join("\r\n");
}
