"""Journal d'administration : connexions, comptes, projets, suppressions, erreurs.

Les modifications d'un ticket n'y figurent pas : elles sont dans l'historique du ticket.
"""

from datetime import timedelta

from fastapi import Request
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models import LogEntry, LogLevel, User, utcnow

# Durée de conservation recommandée par la CNIL pour des journaux de connexion.
RETENTION = timedelta(days=365)


def client_ip(request: Request) -> str | None:
    return request.client.host if request.client else None


def record(
    db: Session,
    message: str,
    *,
    actor: User | None = None,
    request: Request | None = None,
    level: LogLevel = LogLevel.INFO,
) -> None:
    """Ajoute une ligne au journal, enregistrée avec la transaction en cours."""
    db.add(
        LogEntry(
            level=level,
            actor=actor.username if actor else None,
            ip=client_ip(request) if request else None,
            message=message[:500],
        )
    )


def purge(db: Session) -> None:
    db.execute(delete(LogEntry).where(LogEntry.created_at < utcnow() - RETENTION))
