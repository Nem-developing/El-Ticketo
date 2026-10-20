import type { TicketPriority, TicketStatus } from "../api/types";

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

/** Catégories proposées en un clic ; "Autre" permet d'en saisir une librement. */
export const SUGGESTED_CATEGORIES = [
  "Support technique",
  "Demande d'information",
  "Problème de compte",
  "Bug",
  "Suggestion",
];
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
