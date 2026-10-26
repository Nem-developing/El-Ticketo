// Client HTTP minimal : ajoute le token, normalise les erreurs et gère l'expiration de session.

export const TOKEN_KEY = "elticketo.token";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export const tokenStorage = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Stockage indisponible (navigation privée) : la session ne survivra pas au rechargement.
    }
  },
  clear() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Rien à nettoyer.
    }
  },
};

let unauthorizedHandler: (() => void) | null = null;

/** Appelé quand l'API rejette le token (session expirée ou révoquée). */
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

type QueryValue = string | number | boolean | null | undefined | readonly (string | number)[];

function buildUrl(path: string, query?: object): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries((query ?? {}) as Record<string, QueryValue>)) {
    if (value === undefined || value === null || value === "") continue;
    const values: readonly (string | number | boolean)[] = Array.isArray(value) ? value : [value];
    for (const item of values) params.append(key, String(item));
  }
  const search = params.toString();
  return `/api${path}${search ? `?${search}` : ""}`;
}

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail)) return "Certaines informations saisies sont invalides.";
  } catch {
    // Corps vide ou non JSON.
  }
  return response.status >= 500
    ? "Le serveur a rencontré une erreur, réessayez dans un instant."
    : `Erreur inattendue (${response.status}).`;
}

/** `body` est envoyé en JSON, sauf un fichier (Blob), envoyé tel quel. */
async function request<T>(
  method: string,
  path: string,
  { body, query }: { body?: unknown; query?: object } = {},
): Promise<T> {
  const token = tokenStorage.get();
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const isFile = body instanceof Blob;
  if (body !== undefined) {
    headers["Content-Type"] = isFile ? body.type || "application/octet-stream" : "application/json";
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : isFile ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, "Impossible de joindre le serveur.");
  }

  // Seule la première requête refusée avec le token courant déclenche la déconnexion
  // (plusieurs requêtes parallèles peuvent échouer en même temps).
  if (response.status === 401 && token && tokenStorage.get() === token) {
    tokenStorage.clear();
    unauthorizedHandler?.();
  }
  if (!response.ok) throw new ApiError(response.status, await readErrorMessage(response));
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}

export const api = {
  get: <T>(path: string, query?: object) => request<T>("GET", path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
  delete: <T = void>(path: string) => request<T>("DELETE", path),
  upload: <T>(path: string, file: File, query?: object) =>
    request<T>("POST", path, { body: file, query: { ...query, name: file.name } }),
};

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Une erreur inattendue est survenue.";
}
