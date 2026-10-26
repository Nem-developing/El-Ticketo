import {
  ArrowLeft,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  ListTodo,
  Plus,
  ScrollText,
  Settings,
  Ticket,
  Users,
  Webhook,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation, type Location } from "react-router";

import { useVersion } from "../../api/queries";
import { useCurrentUser } from "../../auth/context";
import { isAdminArea } from "./area";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  isActive: (location: Location) => boolean;
}

const isMineView = (location: Location) =>
  new URLSearchParams(location.search).get("view") === "mine";

const MAIN_NAV: NavItem[] = [
  {
    to: "/",
    label: "Tableau de bord",
    icon: LayoutDashboard,
    isActive: (location) => location.pathname === "/",
  },
  {
    to: "/tickets",
    label: "Tickets",
    icon: Ticket,
    isActive: (location) =>
      location.pathname.startsWith("/tickets") &&
      location.pathname !== "/tickets/new" &&
      !isMineView(location),
  },
  {
    to: "/tickets?view=mine",
    label: "Mes tickets",
    icon: ListTodo,
    isActive: (location) => location.pathname === "/tickets" && isMineView(location),
  },
];

const adminItem = (path: string, label: string, icon: LucideIcon): NavItem => ({
  to: `/admin/${path}`,
  label,
  icon,
  isActive: (location) => location.pathname.startsWith(`/admin/${path}`),
});

const ADMIN_NAV: NavItem[] = [
  adminItem("overview", "Vue d'ensemble", Gauge),
  adminItem("users", "Utilisateurs", Users),
  adminItem("projects", "Projets", FolderKanban),
  adminItem("webhooks", "Webhooks", Webhook),
  adminItem("logs", "Journal", ScrollText),
];

function NavEntry({ item }: { item: NavItem }) {
  const location = useLocation();
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className="nav__link"
      aria-current={item.isActive(location) ? "page" : undefined}
    >
      <Icon size={18} aria-hidden="true" />
      {item.label}
    </Link>
  );
}

/** Soit le menu des tickets, soit celui de l'administration : on passe de l'un à l'autre en bas. */
export function Sidebar() {
  const user = useCurrentUser();
  const version = useVersion();
  const inAdmin = isAdminArea(useLocation().pathname);

  return (
    <aside className="sidebar" aria-label="Navigation principale">
      <Link to={inAdmin ? "/admin" : "/"} className="sidebar__brand">
        <img src="/favicon.svg" alt="" width={28} height={28} />
        El Ticketo
      </Link>

      {inAdmin ? (
        <nav className="nav" aria-label="Administration">
          <p className="nav__section">Administration</p>
          {ADMIN_NAV.map((item) => (
            <NavEntry key={item.to} item={item} />
          ))}
        </nav>
      ) : (
        <>
          <Link to="/tickets/new" className="button button--primary sidebar__cta">
            <Plus size={18} aria-hidden="true" />
            Nouveau ticket
          </Link>
          <nav className="nav">
            {MAIN_NAV.map((item) => (
              <NavEntry key={item.to} item={item} />
            ))}
          </nav>
        </>
      )}

      <div className="sidebar__footer">
        {inAdmin ? (
          <Link to="/" className="nav__link">
            <ArrowLeft size={18} aria-hidden="true" />
            Retour aux tickets
          </Link>
        ) : (
          user.is_admin && (
            <Link to="/admin" className="nav__link">
              <Settings size={18} aria-hidden="true" />
              Administration
            </Link>
          )
        )}
        {version.data && <p className="sidebar__version">Version {version.data}</p>}
      </div>
    </aside>
  );
}
