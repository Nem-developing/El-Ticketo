import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import { useMarkNotificationsRead, useNotifications } from "../../api/queries";
import { useCurrentUser } from "../../auth/context";
import { useUnreadInTitle } from "../../lib/documentTitle";
import { formatDateTime, formatRelative } from "../../lib/format";
import { NOTIFICATION_LABELS } from "../../lib/labels";

/** Cloche de la barre du haut : mentions et assignations, lues en ouvrant le ticket. */
export function Notifications() {
  const user = useCurrentUser();
  const notifications = useNotifications();
  const markRead = useMarkNotificationsRead();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const items = notifications.data ?? [];
  const unread = items.filter((item) => !item.is_read).length;
  useUnreadInTitle(unread);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="notifications" ref={containerRef}>
      <button
        type="button"
        className="icon-button notifications__button"
        aria-label={unread > 0 ? `Notifications (${unread} non lues)` : "Notifications"}
        title="Notifications"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Bell size={18} aria-hidden="true" />
        {unread > 0 && (
          <span className="notifications__count" aria-hidden="true">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <section className="notifications__panel" aria-labelledby="notifications-title">
          <div className="notifications__header">
            <h2 id="notifications-title" className="card__title">
              Notifications
            </h2>
            {unread > 0 && (
              <button type="button" className="link-button" onClick={() => markRead.mutate()}>
                Tout marquer comme lu
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="muted notifications__empty">
              Vous serez prévenu ici quand quelqu'un vous mentionne (@{user.username}) ou vous
              assigne un ticket.
            </p>
          ) : (
            <ul className="notifications__list">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`/tickets/${item.ticket.id}`}
                    className={`notification ${item.is_read ? "" : "notification--unread"}`}
                    onClick={() => setOpen(false)}
                  >
                    <span>
                      <strong>{item.actor.username}</strong> {NOTIFICATION_LABELS[item.kind]}
                      {!item.is_read && <span className="visually-hidden"> (non lue)</span>}
                    </span>
                    <span className="notification__meta">
                      #{item.ticket.id} {item.ticket.title} ·{" "}
                      <time dateTime={item.created_at} title={formatDateTime(item.created_at)}>
                        {formatRelative(item.created_at)}
                      </time>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
