from collections import Counter
from datetime import date, datetime, time, timedelta
from typing import Annotated
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import Select, func, select

from app.deps import CurrentUser, DbSession
from app.models import Ticket, TicketStatus
from app.schemas import CategoryCount, StatsOut, StatusCounts, TimelinePoint

router = APIRouter(prefix="/stats", tags=["stats"])


def _zone(name: str) -> ZoneInfo:
    try:
        return ZoneInfo(name)
    except (ZoneInfoNotFoundError, ValueError, OSError):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Fuseau horaire inconnu."
        ) from None


@router.get("", response_model=StatsOut)
def get_stats(
    db: DbSession,
    _: CurrentUser,
    project_id: int | None = None,
    days: Annotated[int, Query(ge=1, le=365, description="Profondeur de la timeline")] = 30,
    tz: Annotated[
        str, Query(max_length=64, description="Fuseau des jours de la timeline (IANA)")
    ] = "UTC",
):
    """Compteurs par statut, répartition par catégorie et activité quotidienne."""
    zone = _zone(tz)

    def scoped(query: Select) -> Select:
        return query if project_id is None else query.where(Ticket.project_id == project_id)

    by_status = dict(
        db.execute(scoped(select(Ticket.status, func.count()).group_by(Ticket.status))).all()
    )
    counts = StatusCounts(
        **{ticket_status.value: by_status.get(ticket_status, 0) for ticket_status in TicketStatus},
        total=sum(by_status.values()),
    )

    category_count = func.count().label("count")
    category_rows = db.execute(
        scoped(
            select(Ticket.category, category_count)
            .group_by(Ticket.category)
            .order_by(category_count.desc(), Ticket.category)
        )
    )
    by_category = [
        CategoryCount(category=category, count=count) for category, count in category_rows
    ]

    # Les jours sont découpés en Python dans le fuseau demandé : le résultat ne dépend ni du
    # fuseau du serveur ni des fonctions de date propres à chaque base de données.
    today = datetime.now(zone).date()
    start = today - timedelta(days=days - 1)
    since = datetime.combine(start, time.min, tzinfo=zone)

    def count_per_day(column) -> Counter[date]:
        moments = db.scalars(scoped(select(column).where(column >= since)))
        return Counter(moment.astimezone(zone).date() for moment in moments)

    created = count_per_day(Ticket.created_at)
    closed = count_per_day(Ticket.closed_at)
    timeline = [
        TimelinePoint(date=day, created=created[day], closed=closed[day])
        for day in (start + timedelta(days=offset) for offset in range(days))
    ]

    return StatsOut(counts=counts, by_category=by_category, timeline=timeline)
