from fastapi import APIRouter, status
from sqlalchemy import select, update

from app.deps import CurrentUser, DbSession
from app.models import Notification
from app.schemas import NotificationOut

router = APIRouter(prefix="/notifications", tags=["notifications"])

LIMIT = 50


@router.get("", response_model=list[NotificationOut])
def list_notifications(db: DbSession, user: CurrentUser):
    """Notifications de l'utilisateur connecté, des plus récentes aux plus anciennes."""
    query = (
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .limit(LIMIT)
    )
    return db.scalars(query).all()


@router.post("/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_as_read(db: DbSession, user: CurrentUser, ticket_id: int | None = None) -> None:
    """Marque comme lues les notifications d'un ticket, ou toutes sans `ticket_id`."""
    query = update(Notification).where(
        Notification.user_id == user.id, Notification.is_read.is_(False)
    )
    if ticket_id is not None:
        query = query.where(Notification.ticket_id == ticket_id)
    db.execute(query.values(is_read=True))
    db.commit()
