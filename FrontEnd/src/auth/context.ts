import { createContext, useContext } from "react";

import type { User } from "../api/types";

export interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  /** Échec de récupération de la session autre qu'un refus (serveur injoignable…). */
  sessionError: unknown;
  retrySession: () => void;
  login: (username: string, password: string) => Promise<void>;
  /** Session ouverte ailleurs (retour du SSO). */
  loginWithToken: (token: string) => void;
  logout: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth doit être utilisé dans <AuthProvider>.");
  return context;
}

/** Utilisateur connecté — à utiliser uniquement sous une route protégée. */
export function useCurrentUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error("Aucun utilisateur connecté.");
  return user;
}
