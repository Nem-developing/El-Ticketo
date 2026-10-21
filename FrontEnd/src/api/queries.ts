// Hooks react-query : lecture et écriture des ressources de l'API, avec invalidation du cache.

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";

import { api } from "./client";
import type {
  Comment,
  Project,
  ProjectInput,
  Stats,
  Ticket,
  TicketCreate,
  TicketFilters,
  TicketUpdate,
  User,
  UserCreate,
  UserUpdate,
} from "./types";

/** Les listes et le tableau de bord se rafraîchissent seuls (tickets créés par les collègues). */
const AUTO_REFRESH_MS = 60_000;

/** Les jours de la timeline sont découpés dans le fuseau du navigateur. */
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export const queryKeys = {
  me: ["me"] as const,
  users: ["users"] as const,
  projects: ["projects"] as const,
  tickets: (filters?: TicketFilters) => (filters ? (["tickets", filters] as const) : ["tickets"]),
  ticket: (id: number) => ["ticket", id] as const,
  comments: (ticketId: number) => ["comments", ticketId] as const,
  stats: (projectId?: number, days?: number) =>
    projectId === undefined ? ["stats"] : (["stats", projectId, days] as const),
};

/** Après une écriture sur un ticket, les listes et les stats doivent être rafraîchies. */
function invalidateTicketViews(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.tickets() });
  queryClient.invalidateQueries({ queryKey: queryKeys.stats() });
}

// --- Lecture --------------------------------------------------------------------

export const useProjects = () =>
  useQuery({ queryKey: queryKeys.projects, queryFn: () => api.get<Project[]>("/projects") });

export const useUsers = () =>
  useQuery({ queryKey: queryKeys.users, queryFn: () => api.get<User[]>("/users") });

export const useTickets = (filters: TicketFilters, enabled = true) =>
  useQuery({
    queryKey: queryKeys.tickets(filters),
    queryFn: () => api.get<Ticket[]>("/tickets", filters),
    placeholderData: keepPreviousData,
    refetchInterval: AUTO_REFRESH_MS,
    enabled,
  });

export const useTicket = (id: number) =>
  useQuery({
    queryKey: queryKeys.ticket(id),
    queryFn: () => api.get<Ticket>(`/tickets/${id}`),
    enabled: Number.isInteger(id) && id > 0,
  });

export const useComments = (ticketId: number) =>
  useQuery({
    queryKey: queryKeys.comments(ticketId),
    queryFn: () => api.get<Comment[]>(`/tickets/${ticketId}/comments`),
    refetchInterval: AUTO_REFRESH_MS,
  });

export const useStats = (projectId: number | undefined, days: number) =>
  useQuery({
    queryKey: queryKeys.stats(projectId, days),
    queryFn: () => api.get<Stats>("/stats", { project_id: projectId, days, tz: TIME_ZONE }),
    placeholderData: keepPreviousData,
    refetchInterval: AUTO_REFRESH_MS,
    enabled: projectId !== undefined,
  });

// --- Tickets --------------------------------------------------------------------

export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TicketCreate) => api.post<Ticket>("/tickets", data),
    onSuccess: (ticket) => {
      queryClient.setQueryData(queryKeys.ticket(ticket.id), ticket);
      invalidateTicketViews(queryClient);
    },
  });
}

export function useUpdateTicket(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: TicketUpdate) => api.patch<Ticket>(`/tickets/${id}`, changes),
    onSuccess: (ticket) => {
      queryClient.setQueryData(queryKeys.ticket(id), ticket);
      invalidateTicketViews(queryClient);
    },
  });
}

export function useDeleteTicket(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.delete(`/tickets/${id}`),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: queryKeys.ticket(id) });
      invalidateTicketViews(queryClient);
    },
  });
}

// --- Commentaires ---------------------------------------------------------------

export function useCommentMutations(ticketId: number) {
  const queryClient = useQueryClient();
  const base = `/tickets/${ticketId}/comments`;
  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.comments(ticketId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.ticket(ticketId) });
  };

  return {
    add: useMutation({
      mutationFn: (body: string) => api.post<Comment>(base, { body }),
      onSuccess,
    }),
    edit: useMutation({
      mutationFn: ({ id, body }: { id: number; body: string }) =>
        api.patch<Comment>(`${base}/${id}`, { body }),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (id: number) => api.delete(`${base}/${id}`),
      onSuccess,
    }),
  };
}

// --- Administration -------------------------------------------------------------

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserCreate) => api.post<User>("/users", data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users }),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: UserUpdate }) =>
      api.patch<User>(`/users/${id}`, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.users }),
  });
}

export function useSaveProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id?: number; data: ProjectInput }) =>
      id === undefined
        ? api.post<Project>("/projects", data)
        : api.patch<Project>(`/projects/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.projects }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      api.put<void>("/auth/me/password", data),
  });
}
