"""Notifications : prévenir quelqu'un qu'on l'a mentionné (@identifiant) ou qu'on lui a assigné
un ticket. Elles s'affichent dans l'application ; ouvrir le ticket les marque comme lues."""

import re
from datetime import timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import Notification, NotificationKind, Ticket, User, utcnow

# « @alice » ou « @jean.dupont », mais ni une adresse e-mail ni le point qui finit la phrase.
MENTION = re.compile(r"(?<![\w.@-])@([a-z0-9._-]*[a-z0-9_-])", re.IGNORECASE)
# Le code (bloc ``` ou `en ligne`) s'affiche tel quel : « @Override » n'y mentionne personne.
CODE = re.compile(r"```.*?```|`[^`\n]+`", re.DOTALL)
RETENTION = timedelta(days=180)


def mentioned(text: str) -> set[str]:
    return {name.lower() for name in MENTION.findall(CODE.sub(" ", text))}


def notify_mentions(
    db: Session, ticket: Ticket, actor: User, text: str, previous: str = ""
) -> None:
    """Prévient les personnes mentionnées dans `text`, sauf celles qui l'étaient déjà dans
    `previous` (texte modifié) et l'auteur lui-même."""
    names = mentioned(text) - mentioned(previous) - {actor.username}
    if names:
        query = select(User.id).where(User.username.in_(names), User.is_active)
        for user_id in db.scalars(query).all():
            _notify(db, user_id, NotificationKind.MENTION, ticket, actor)


def notify_assignment(db: Session, ticket: Ticket, actor: User) -> None:
    """Prévient le nouvel assigné, sauf s'il s'est assigné le ticket lui-même."""
    if ticket.assignee_id not in (None, actor.id):
        _notify(db, ticket.assignee_id, NotificationKind.ASSIGNMENT, ticket, actor)


def _notify(db: Session, user_id: int, kind: NotificationKind, ticket: Ticket, actor: User) -> None:
    # Une seule notification non lue par ticket et par motif : la plus récente la remplace.
    unread = db.scalar(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.ticket_id == ticket.id,
            Notification.kind == kind,
            Notification.is_read.is_(False),
        )
    )
    if unread:
        unread.actor_id = actor.id
        unread.created_at = utcnow()
    else:
        db.add(Notification(user_id=user_id, ticket_id=ticket.id, actor_id=actor.id, kind=kind))


def purge(db: Session) -> None:
    db.execute(delete(Notification).where(Notification.created_at < utcnow() - RETENTION))
