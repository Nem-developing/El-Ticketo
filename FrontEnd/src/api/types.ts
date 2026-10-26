// Types renvoyés par l'API (voir /api/docs).

export type TicketStatus = "new" | "in_progress" | "waiting" | "closed";
export type TicketPriority = "low" | "normal" | "high";

export interface UserSummary {
  id: number;
  username: string;
}

export interface User extends UserSummary {
  is_admin: boolean;
  is_active: boolean;
  /** Compte rattaché au SSO : il se connecte sans mot de passe. */
  sso: boolean;
  created_at: string;
}

export interface Project {
  id: number;
  name: string;
  description: string;
  /** Catégories proposées à l'ouverture d'un ticket, dans l'ordre d'affichage. */
  categories: string[];
  created_at: string;
}

export interface Ticket {
  id: number;
  project_id: number;
  title: string;
  description: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  created_by: UserSummary;
  assignee: UserSummary | null;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface Comment {
  id: number;
  ticket_id: number;
  author: UserSummary;
  body: string;
  attachments: Attachment[];
  created_at: string;
  updated_at: string | null;
}

export type TicketField =
  "title" | "description" | "category" | "priority" | "status" | "assignee" | "project";

export interface TicketEvent {
  id: number;
  actor: UserSummary;
  field: TicketField;
  value: string | null;
  created_at: string;
}

export interface Attachment {
  id: number;
  ticket_id: number;
  filename: string;
  content_type: string;
  size: number;
  uploaded_by: UserSummary;
  created_at: string;
  /** Lien signé vers le fichier, utilisable sans token (balise <img>, téléchargement). */
  url: string;
}

export interface Workload {
  open: number;
  closed_recently: number;
}

export interface Overview {
  projects: (Workload & {
    id: number;
    name: string;
    unassigned: number;
    stale: number;
    resolution_hours: number | null;
  })[];
  people: (Workload & { user: User })[];
  oldest_open: Ticket[];
}

export interface Stats {
  counts: Record<TicketStatus | "total", number>;
  by_category: { category: string; count: number }[];
  timeline: { date: string; created: number; closed: number }[];
}

export interface LogEntry {
  id: number;
  created_at: string;
  level: "info" | "warning" | "error";
  actor: string | null;
  ip: string | null;
  message: string;
}

export type WebhookEvent =
  "ticket.created" | "ticket.updated" | "ticket.deleted" | "comment.created" | "user.created";

export interface Webhook {
  id: number;
  url: string;
  events: WebhookEvent[];
  created_at: string;
}

export type WebhookInput = Pick<Webhook, "url" | "events">;

export interface SsoConfig {
  enabled: boolean;
  issuer: string;
  client_id: string;
  /** Le secret n'est jamais renvoyé : on sait seulement s'il est enregistré. */
  has_secret: boolean;
  /** Adresse de retour à déclarer chez le fournisseur d'identité. */
  redirect_uri: string;
}

export type SsoConfigInput = Pick<SsoConfig, "enabled" | "issuer" | "client_id"> & {
  /** null : garder le secret enregistré. */
  client_secret: string | null;
};

export interface LoginResponse {
  access_token: string;
  expires_at: string;
  user: User;
}

export interface TicketCreate {
  project_id: number;
  title: string;
  description: string;
  category: string;
  priority: TicketPriority;
}

export type TicketUpdate = Partial<
  Pick<Ticket, "title" | "description" | "category" | "priority" | "status" | "project_id">
> & { assignee_id?: number | null };

export interface TicketFilters {
  project_id?: number;
  status?: TicketStatus[];
  assignee_id?: number;
  created_by_id?: number;
  category?: string;
  q?: string;
  limit?: number;
}

export interface UserCreate {
  username: string;
  password: string;
  is_admin: boolean;
}

export type UserUpdate = Partial<Pick<User, "is_admin" | "is_active">> & { password?: string };

/** Sans `categories`, un nouveau projet reçoit la liste par défaut. */
export type ProjectInput = Pick<Project, "name" | "description"> & { categories?: string[] };
