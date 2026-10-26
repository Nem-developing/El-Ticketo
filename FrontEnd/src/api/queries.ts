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
  Attachment,
  Comment,
  LogEntry,
  Overview,
  Project,
  ProjectInput,
  SsoConfig,
  SsoConfigInput,
  Stats,
  Ticket,
  TicketCreate,
  TicketEvent,
  TicketFilters,
  TicketNotification,
  TicketUpdate,
  User,
  UserCreate,
  UserUpdate,
  Webhook,
  WebhookInput,
} from "./types";

/** Les listes et le tableau de bord se rafraîchissent seuls (tickets créés par les collègues). */
const AUTO_REFRESH_MS = 60_000;

/** Les jours de la timeline sont découpés dans le fuseau du navigateur. */
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export const queryKeys = {
  me: ["me"] as const,
  sso: ["sso"] as const,
  ssoConfig: ["sso-config"] as const,
  version: ["version"] as const,
  users: ["users"] as const,
  projects: ["projects"] as const,
  tickets: (filters?: TicketFilters) => (filters ? (["tickets", filters] as const) : ["tickets"]),
  ticket: (id: number) => ["ticket", id] as const,
  comments: (ticketId: number) => ["comments", ticketId] as const,
  events: (ticketId: number) => ["events", ticketId] as const,
  attachments: (ticketId: number) => ["attachments", ticketId] as const,
  notifications: ["notifications"] as const,
  overview: ["overview"] as const,
  logs: (q: string) => ["logs", q] as const,
  webhooks: ["webhooks"] as const,
  stats: (projectId?: number, days?: number) =>
    projectId === undefined ? ["stats"] : (["stats", projectId, days] as const),
};

/** Envoie les fichiers un par un ; un fichier refusé n'empêche pas les autres. */
async function uploadAll(path: string, files: File[], query?: object): Promise<number> {
  const uploads = await Promise.allSettled(files.map((file) => api.upload(path, file, query)));
  return uploads.filter((upload) => upload.status === "rejected").length;
}

/** Après une écriture sur un ticket, les listes et les stats doivent être rafraîchies. */
function invalidateTicketViews(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: queryKeys.tickets() });
  queryClient.invalidateQueries({ queryKey: queryKeys.stats() });
  queryClient.invalidateQueries({ queryKey: queryKeys.overview });
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

export const useTicketEvents = (ticketId: number) =>
  useQuery({
    queryKey: queryKeys.events(ticketId),
    queryFn: () => api.get<TicketEvent[]>(`/tickets/${ticketId}/events`),
    refetchInterval: AUTO_REFRESH_MS,
  });

export const useAttachments = (ticketId: number) =>
  useQuery({
    queryKey: queryKeys.attachments(ticketId),
    queryFn: () => api.get<Attachment[]>(`/tickets/${ticketId}/attachments`),
    refetchInterval: AUTO_REFRESH_MS,
  });

export const useNotifications = () =>
  useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => api.get<TicketNotification[]>("/notifications"),
    refetchInterval: AUTO_REFRESH_MS,
  });

export const useOverview = () =>
  useQuery({
    queryKey: queryKeys.overview,
    queryFn: () => api.get<Overview>("/stats/overview"),
    refetchInterval: AUTO_REFRESH_MS,
  });

export const useLogs = (q: string, limit: number) =>
  useQuery({
    queryKey: queryKeys.logs(q),
    queryFn: () => api.get<LogEntry[]>("/logs", { q, limit }),
    placeholderData: keepPreviousData,
    refetchInterval: AUTO_REFRESH_MS,
  });

export const useWebhooks = () =>
  useQuery({ queryKey: queryKeys.webhooks, queryFn: () => api.get<Webhook[]>("/webhooks") });

/** Le SSO est-il proposé sur la page de connexion ? */
export const useSsoEnabled = () =>
  useQuery({
    queryKey: queryKeys.sso,
    queryFn: () => api.get<{ enabled: boolean }>("/auth/sso"),
    select: (sso) => sso.enabled,
    staleTime: Infinity,
  });

export const useSsoConfig = () =>
  useQuery({ queryKey: queryKeys.ssoConfig, queryFn: () => api.get<SsoConfig>("/sso") });

/** Version déployée (tag git de la release). */
export const useVersion = () =>
  useQuery({
    queryKey: queryKeys.version,
    queryFn: () => api.get<{ version: string }>("/health"),
    select: (health) => health.version,
    staleTime: Infinity,
  });

// --- Tickets --------------------------------------------------------------------

/** Crée le ticket puis envoie ses pièces jointes ; un fichier refusé n'annule pas la création. */
export function useCreateTicket() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ data, files }: { data: TicketCreate; files: File[] }) => {
      const ticket = await api.post<Ticket>("/tickets", data);
      const failedUploads = await uploadAll(`/tickets/${ticket.id}/attachments`, files);
      return { ticket, failedUploads };
    },
    onSuccess: ({ ticket }) => {
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
      queryClient.invalidateQueries({ queryKey: queryKeys.events(id) });
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
    /** Le commentaire est créé, puis ses fichiers y sont joints. */
    add: useMutation({
      mutationFn: async ({ body, files }: { body: string; files: File[] }) => {
        const comment = await api.post<Comment>(base, { body });
        const failedUploads = await uploadAll(`/tickets/${ticketId}/attachments`, files, {
          comment_id: comment.id,
        });
        return { comment, failedUploads };
      },
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

// --- Pièces jointes ---------------------------------------------------------------

export function useAttachmentMutations(ticketId: number) {
  const queryClient = useQueryClient();
  // Le fichier supprimé peut appartenir au ticket ou à l'un de ses commentaires.
  const onSuccess = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.attachments(ticketId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.comments(ticketId) });
  };

  return {
    upload: useMutation({
      mutationFn: (file: File) => api.upload<Attachment>(`/tickets/${ticketId}/attachments`, file),
      onSuccess,
    }),
    remove: useMutation({
      mutationFn: (id: number) => api.delete(`/attachments/${id}`),
      onSuccess,
    }),
  };
}

// --- Notifications ----------------------------------------------------------------

/** Marque comme lues les notifications d'un ticket, ou toutes sans identifiant. */
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();
  const key = queryKeys.notifications;
  return useMutation({
    mutationFn: (ticketId?: number) =>
      api.post<void>(`/notifications/read${ticketId ? `?ticket_id=${ticketId}` : ""}`),
    // Le compteur baisse tout de suite, sans attendre la réponse.
    onMutate: (ticketId) =>
      queryClient.setQueryData<TicketNotification[]>(key, (items) =>
        items?.map((item) =>
          ticketId === undefined || item.ticket.id === ticketId ? { ...item, is_read: true } : item,
        ),
      ),
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  });
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

export function useWebhookMutations() {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: queryKeys.webhooks });
  return {
    save: useMutation({
      mutationFn: ({ id, data }: { id?: number; data: WebhookInput }) =>
        id === undefined
          ? api.post<Webhook>("/webhooks", data)
          : api.put<Webhook>(`/webhooks/${id}`, data),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (id: number) => api.delete(`/webhooks/${id}`), onSuccess }),
    test: useMutation({ mutationFn: (id: number) => api.post<void>(`/webhooks/${id}/test`) }),
  };
}

export function useSsoMutations() {
  const queryClient = useQueryClient();
  return {
    save: useMutation({
      mutationFn: (data: SsoConfigInput) => api.put<SsoConfig>("/sso", data),
      onSuccess: (config) => {
        queryClient.setQueryData(queryKeys.ssoConfig, config);
        queryClient.invalidateQueries({ queryKey: queryKeys.sso });
      },
    }),
    /** Renvoie l'adresse du fournisseur, que le navigateur doit suivre. */
    test: useMutation({ mutationFn: () => api.post<{ url: string }>("/sso/test") }),
  };
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: { current_password: string; new_password: string }) =>
      api.put<void>("/auth/me/password", data),
  });
}
