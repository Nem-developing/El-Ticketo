import type { ReactNode } from "react";

import { errorMessage } from "../../api/client";

export function Loader({ label = "Chargement…", fullscreen = false }) {
  return (
    <div className={fullscreen ? "state state--fullscreen" : "state"} role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="state__hint">{label}</span>
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  fullscreen = false,
}: {
  error: unknown;
  onRetry?: () => void;
  fullscreen?: boolean;
}) {
  return (
    <div className={fullscreen ? "state state--fullscreen" : "state"} role="alert">
      <p className="state__title">Impossible de charger les données</p>
      <p className="state__hint">{errorMessage(error)}</p>
      {onRetry && (
        <button type="button" className="button" onClick={() => onRetry()}>
          Réessayer
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="state">
      <p className="state__title">{title}</p>
      {hint && <p className="state__hint">{hint}</p>}
      {action}
    </div>
  );
}
