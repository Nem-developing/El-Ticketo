import {
  FolderKanban,
  Gauge,
  LayoutDashboard,
  ListTodo,
  Plus,
  ScrollText,
  Ticket,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Link, useLocation, type Location } from "react-router";

import { useVersion } from "../../api/queries";
import { useCurrentUser } from "../../auth/context";

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

const ADMIN_NAV: NavItem[] = [
  {
    to: "/admin/overview",
    label: "Vue d'ensemble",
    icon: Gauge,
    isActive: (location) => location.pathname.startsWith("/admin/overview"),
  },
  {
    to: "/admin/users",
    label: "Utilisateurs",
    icon: Users,
    isActive: (location) => location.pathname.startsWith("/admin/users"),
  },
  {
    to: "/admin/projects",
    label: "Projets",
    icon: FolderKanban,
    isActive: (location) => location.pathname.startsWith("/admin/projects"),
  },
  {
    to: "/admin/logs",
    label: "Journal",
    icon: ScrollText,
    isActive: (location) => location.pathname.startsWith("/admin/logs"),
  },
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

export function Sidebar() {
  const user = useCurrentUser();
  const version = useVersion();

  return (
    <aside className="sidebar" aria-label="Navigation principale">
      <Link to="/" className="sidebar__brand">
        <img src="/favicon.svg" alt="" width={28} height={28} />
        El Ticketo
      </Link>

      <Link to="/tickets/new" className="button button--primary sidebar__cta">
        <Plus size={18} aria-hidden="true" />
        Nouveau ticket
      </Link>

      <nav className="nav">
        {MAIN_NAV.map((item) => (
          <NavEntry key={item.to} item={item} />
        ))}
      </nav>

      {user.is_admin && (
        <nav className="nav" aria-label="Administration">
          <p className="nav__section">Administration</p>
          {ADMIN_NAV.map((item) => (
            <NavEntry key={item.to} item={item} />
          ))}
        </nav>
      )}

      {version.data && <p className="sidebar__version">Version {version.data}</p>}
    </aside>
  );
}
