import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fullscreen?: boolean;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Remplace un écran blanc par un message lorsqu'une page plante au rendu
 * (bug, ou fichier JS introuvable après un redéploiement).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erreur d'affichage :", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className={this.props.fullscreen ? "state state--fullscreen" : "state"} role="alert">
        <p className="state__title">Cette page n'a pas pu s'afficher</p>
        <p className="state__hint">
          Une erreur inattendue est survenue. Rechargez la page ; si le problème persiste,
          signalez-le à un administrateur.
        </p>
        <button type="button" className="button" onClick={() => window.location.reload()}>
          Recharger
        </button>
      </div>
    );
  }
}
