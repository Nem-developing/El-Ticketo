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
  created_at: string;
}

export interface Project {
  id: number;
  name: string;
  description: string;
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
  created_at: string;
  updated_at: string | null;
}

export interface Stats {
  counts: Record<TicketStatus | "total", number>;
  by_category: { category: string; count: number }[];
  timeline: { date: string; created: number; closed: number }[];
}

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
  Pick<Ticket, "title" | "description" | "category" | "priority" | "status">
> & { assignee_id?: number | null };

export interface TicketFilters {
  project_id?: number;
  status?: TicketStatus[];
  assignee_id?: number;
  q?: string;
  limit?: number;
}

export interface UserCreate {
  username: string;
  password: string;
  is_admin: boolean;
}

export type UserUpdate = Partial<Pick<User, "is_admin" | "is_active">> & { password?: string };

export interface ProjectInput {
  name: string;
  description: string;
}
