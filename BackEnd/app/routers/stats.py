from collections import Counter
from datetime import date, datetime, time, timedelta
from typing import Annotated
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import Select, func, select

from app.deps import AdminUser, CurrentUser, DbSession
from app.models import Project, Ticket, TicketStatus, User, utcnow
from app.schemas import (
    CategoryCount,
    OverviewOut,
    PersonOverview,
    ProjectOverview,
    StatsOut,
    StatusCounts,
    TimelinePoint,
)

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


STALE_AFTER = timedelta(days=7)
RECENT = timedelta(days=30)


@router.get("/overview", response_model=OverviewOut)
def get_overview(db: DbSession, _: AdminUser):
    """Charge de travail par projet et par personne, tous projets confondus (admin)."""
    now = utcnow()
    open_tickets = db.execute(
        select(Ticket.project_id, Ticket.assignee_id, Ticket.created_at).where(
            Ticket.status != TicketStatus.CLOSED
        )
    ).all()
    closed_tickets = db.execute(
        select(Ticket.project_id, Ticket.assignee_id, Ticket.created_at, Ticket.closed_at).where(
            Ticket.closed_at >= now - RECENT
        )
    ).all()

    projects = []
    for project in db.scalars(select(Project).order_by(Project.name)):
        opened = [row for row in open_tickets if row.project_id == project.id]
        closed = [row for row in closed_tickets if row.project_id == project.id]
        hours = [(row.closed_at - row.created_at).total_seconds() / 3600 for row in closed]
        projects.append(
            ProjectOverview(
                id=project.id,
                name=project.name,
                open=len(opened),
                unassigned=sum(row.assignee_id is None for row in opened),
                stale=sum(now - row.created_at > STALE_AFTER for row in opened),
                closed_recently=len(closed),
                resolution_hours=sum(hours) / len(hours) if hours else None,
            )
        )

    open_per_person = Counter(row.assignee_id for row in open_tickets)
    closed_per_person = Counter(row.assignee_id for row in closed_tickets)
    users = db.scalars(select(User).order_by(User.username))
    # Un compte désactivé reste listé tant qu'il a des tickets ouverts : ils sont à réassigner.
    people = [
        PersonOverview(
            user=user, open=open_per_person[user.id], closed_recently=closed_per_person[user.id]
        )
        for user in users
        if user.is_active or open_per_person[user.id]
    ]
    people.sort(key=lambda person: -person.open)

    oldest_open = db.scalars(
        select(Ticket)
        .where(Ticket.status != TicketStatus.CLOSED)
        .order_by(Ticket.created_at, Ticket.id)
        .limit(5)
    ).all()
    return OverviewOut(projects=projects, people=people, oldest_open=oldest_open)
