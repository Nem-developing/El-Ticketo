import type { TicketEvent, TicketPriority, TicketStatus } from "../api/types";

export const STATUSES: TicketStatus[] = ["new", "in_progress", "waiting", "closed"];
export const OPEN_STATUSES: TicketStatus[] = ["new", "in_progress", "waiting"];

export const STATUS_LABELS: Record<TicketStatus, string> = {
  new: "Nouveau",
  in_progress: "En cours",
  waiting: "En attente",
  closed: "Fermé",
};

export const PRIORITIES: TicketPriority[] = ["low", "normal", "high"];

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: "Basse",
  normal: "Normale",
  high: "Haute",
};

/** Toujours proposée en plus des catégories du projet, pour en saisir une librement. */
export const OTHER_CATEGORY = "Autre";

/** Longueurs maximales acceptées par l'API. */
export const MAX_LENGTH = {
  title: 200,
  category: 50,
  text: 10_000,
  projectName: 100,
  search: 100,
};

/** Au-delà, un ticket encore ouvert est signalé comme ancien. */
export const STALE_AFTER_DAYS = 7;

/** Phrase de l'historique, sans son auteur : « a passé le statut à « En cours » ». */
export function describeEvent({ field, value, actor }: TicketEvent): string {
  switch (field) {
    case "status":
      return `a passé le statut à « ${STATUS_LABELS[value as TicketStatus]} »`;
    case "priority":
      return `a passé la priorité à « ${PRIORITY_LABELS[value as TicketPriority]} »`;
    case "assignee":
      if (value === null) return "a retiré l'assignation";
      return value === actor.username
        ? "s'est assigné le ticket"
        : `a assigné le ticket à ${value}`;
    case "category":
      return `a changé la catégorie en « ${value} »`;
    case "project":
      return `a déplacé le ticket dans « ${value} »`;
    case "title":
      return `a renommé le ticket en « ${value} »`;
    case "description":
      return "a modifié la description";
  }
}
