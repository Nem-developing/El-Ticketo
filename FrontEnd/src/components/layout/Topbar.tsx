import { LogOut, Menu, UserRound, X } from "lucide-react";
import { Link, useLocation } from "react-router";

import { useAuth, useCurrentUser } from "../../auth/context";
import { useProjectContext } from "../../context/project";
import { isAdminArea } from "./area";

interface TopbarProps {
  menuOpen: boolean;
  onToggleMenu: () => void;
}

export function Topbar({ menuOpen, onToggleMenu }: TopbarProps) {
  const user = useCurrentUser();
  const { logout } = useAuth();
  const { projects, current, select } = useProjectContext();
  const inAdmin = isAdminArea(useLocation().pathname);

  return (
    <header className="topbar">
      <button
        type="button"
        className="icon-button topbar__menu"
        aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
        aria-expanded={menuOpen}
        onClick={onToggleMenu}
      >
        {menuOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {inAdmin ? (
        // L'administration porte sur tous les projets à la fois.
        <span className="topbar__project-name">Administration</span>
      ) : projects.length > 1 ? (
        <select
          className="input topbar__project"
          aria-label="Projet"
          value={current?.id}
          onChange={(event) => select(Number(event.target.value))}
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      ) : (
        <span className="topbar__project-name">{current?.name}</span>
      )}

      <div className="topbar__user">
        <Link to="/account" className="topbar__account" title="Mon compte">
          <UserRound size={18} aria-hidden="true" />
          <span>{user.username}</span>
        </Link>
        <button
          type="button"
          className="icon-button"
          aria-label="Se déconnecter"
          title="Se déconnecter"
          onClick={() => void logout()}
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
