import { Link } from "react-router";

import { EmptyState } from "../components/ui/States";

export function NotFoundPage() {
  return (
    <EmptyState
      title="Page introuvable"
      hint="Le lien est peut-être erroné ou la page a été déplacée."
      action={
        <Link to="/" className="button">
          Retour au tableau de bord
        </Link>
      }
    />
  );
}
