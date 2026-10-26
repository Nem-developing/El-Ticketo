import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";

import { api, setUnauthorizedHandler, TOKEN_KEY, tokenStorage } from "../api/client";
import { queryKeys } from "../api/queries";
import type { LoginResponse, User } from "../api/types";
import { useToast } from "../context/toast";
import { AuthContext, type AuthContextValue } from "./context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const [token, setToken] = useState(() => tokenStorage.get());

  const me = useQuery({
    queryKey: queryKeys.me,
    queryFn: () => api.get<User>("/auth/me"),
    enabled: token !== null,
    staleTime: Infinity,
  });

  const endSession = useCallback(() => {
    tokenStorage.clear();
    setToken(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(() => {
    // Connexion ou déconnexion dans un autre onglet : cet onglet suit la même session,
    // sinon il afficherait un utilisateur tout en envoyant le token d'un autre.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== TOKEN_KEY) return;
      queryClient.clear();
      setToken(tokenStorage.get());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [queryClient]);

  useEffect(() => {
    // Token refusé par l'API (expiré ou révoqué) : retour à l'écran de connexion.
    setUnauthorizedHandler(() => {
      endSession();
      toast.error("Votre session a expiré, reconnectez-vous.");
    });
    return () => setUnauthorizedHandler(null);
  }, [endSession, toast]);

  const login = useCallback(
    async (username: string, password: string) => {
      const session = await api.post<LoginResponse>("/auth/login", { username, password });
      tokenStorage.set(session.access_token);
      queryClient.setQueryData(queryKeys.me, session.user);
      setToken(session.access_token);
    },
    [queryClient],
  );

  const loginWithToken = useCallback((sessionToken: string) => {
    tokenStorage.set(sessionToken);
    setToken(sessionToken);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Session déjà expirée côté serveur : on nettoie quand même localement.
    }
    endSession();
  }, [endSession]);

  const { data, isPending, error, refetch } = me;
  const value = useMemo<AuthContextValue>(
    () => ({
      user: token ? (data ?? null) : null,
      isLoading: token !== null && isPending,
      sessionError: token ? error : null,
      retrySession: () => void refetch(),
      login,
      loginWithToken,
      logout,
    }),
    [token, data, isPending, error, refetch, login, loginWithToken, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
