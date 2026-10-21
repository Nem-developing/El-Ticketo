import { Link, Navigate, Outlet, useLocation } from "react-router";

import { EmptyState, ErrorState, Loader } from "../components/ui/States";
import { useProjectContext } from "../context/project";
import { useAuth } from "./context";

/** Redirige vers la connexion si aucun utilisateur n'est connecté. */
export function RequireAuth() {
  const { user, isLoading, sessionError, retrySession } = useAuth();
  const location = useLocation();

  if (isLoading) return <Loader fullscreen />;
  if (sessionError) {
    // Serveur injoignable : on garde la session et on propose de réessayer.
    return <ErrorState error={sessionError} onRetry={retrySession} fullscreen />;
  }
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

/** Réserve une section aux administrateurs. */
export function RequireAdmin() {
  const { user } = useAuth();
  return user?.is_admin ? <Outlet /> : <Navigate to="/" replace />;
}

/** Pages qui travaillent sur le projet courant (tableau de bord, liste, création). */
export function RequireProject() {
  const { user } = useAuth();
  const { current } = useProjectContext();
  if (current) return <Outlet />;
  return (
    <EmptyState
      title="Aucun projet"
      hint={
        user?.is_admin
          ? "Créez un premier projet pour commencer à ouvrir des tickets."
          : "Un administrateur doit créer un projet avant de pouvoir ouvrir des tickets."
      }
      action={
        user?.is_admin && (
          <Link to="/admin/projects" className="button button--primary">
            Créer un projet
          </Link>
        )
      }
    />
  );
}
