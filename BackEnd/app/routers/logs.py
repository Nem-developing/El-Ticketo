from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import or_, select

from app.deps import AdminUser, DbSession
from app.journal import purge
from app.models import LogEntry
from app.schemas import LogEntryOut

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("", response_model=list[LogEntryOut])
def list_logs(
    db: DbSession,
    _: AdminUser,
    q: Annotated[
        str | None, Query(max_length=100, description="Recherche message ou auteur")
    ] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
):
    """Journal d'administration, du plus récent au plus ancien (conservé un an)."""
    purge(db)
    db.commit()
    query = select(LogEntry)
    if q and q.strip():
        term = q.strip()
        query = query.where(
            or_(
                LogEntry.message.icontains(term, autoescape=True),
                LogEntry.actor.icontains(term, autoescape=True),
            )
        )
    return db.scalars(query.order_by(LogEntry.created_at.desc(), LogEntry.id.desc()).limit(limit))
