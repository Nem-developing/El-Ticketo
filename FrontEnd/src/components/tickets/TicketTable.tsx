import { TriangleAlert } from "lucide-react";
import { Link, useNavigate } from "react-router";

import type { Ticket } from "../../api/types";
import { ageInDays, formatDateTime, formatRelative } from "../../lib/format";
import { STALE_AFTER_DAYS } from "../../lib/labels";
import { useIsUnread } from "../../lib/seen";
import { PriorityBadge, StatusBadge } from "../ui/Badges";

function CreatedAt({ ticket }: { ticket: Ticket }) {
  const stale = ticket.status !== "closed" && ageInDays(ticket.created_at) >= STALE_AFTER_DAYS;
  return (
    <time
      dateTime={ticket.created_at}
      title={formatDateTime(ticket.created_at)}
      className={stale ? "stale" : undefined}
    >
      {formatRelative(ticket.created_at)}
      {stale && (
        <TriangleAlert size={14} aria-label={`Ouvert depuis plus de ${STALE_AFTER_DAYS} jours`} />
      )}
    </time>
  );
}

export function TicketTable({ tickets }: { tickets: Ticket[] }) {
  const navigate = useNavigate();
  const isUnread = useIsUnread();

  return (
    <div className="table-wrapper">
      <table className="table table--clickable">
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Titre</th>
            <th scope="col">Statut</th>
            <th scope="col" className="hide-sm">
              Priorité
            </th>
            <th scope="col" className="hide-md">
              Assigné à
            </th>
            <th scope="col" className="hide-sm">
              Créé
            </th>
          </tr>
        </thead>
        <tbody>
          {tickets.map((ticket) => (
            <tr key={ticket.id} onClick={() => navigate(`/tickets/${ticket.id}`)}>
              <td className="table__id">#{ticket.id}</td>
              <td>
                <Link
                  to={`/tickets/${ticket.id}`}
                  className="table__title"
                  onClick={(event) => event.stopPropagation()}
                >
                  {isUnread(ticket) && (
                    <span className="unread-dot" title="Modifié depuis votre dernière visite">
                      <span className="visually-hidden">Nouveau : </span>
                    </span>
                  )}
                  {ticket.title}
                </Link>
                <span className="table__meta">{ticket.category}</span>
              </td>
              <td>
                <StatusBadge status={ticket.status} />
              </td>
              <td className="hide-sm">
                <PriorityBadge priority={ticket.priority} />
              </td>
              <td className="hide-md">
                {ticket.assignee?.username ?? <span className="muted">Personne</span>}
              </td>
              <td className="hide-sm">
                <CreatedAt ticket={ticket} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
