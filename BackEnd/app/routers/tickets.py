from typing import Annotated

from fastapi import APIRouter, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.deps import AdminUser, CurrentUser, DbSession, get_or_404
from app.models import Comment, Project, Ticket, TicketStatus, User, utcnow
from app.schemas import CommentOut, CommentWrite, TicketCreate, TicketOut, TicketUpdate

router = APIRouter(prefix="/tickets", tags=["tickets"])

TICKET_NOT_FOUND = "Ticket introuvable."


@router.get("", response_model=list[TicketOut])
def list_tickets(
    db: DbSession,
    _: CurrentUser,
    project_id: int | None = None,
    status_: Annotated[list[TicketStatus] | None, Query(alias="status")] = None,
    assignee_id: int | None = None,
    q: Annotated[
        str | None, Query(max_length=100, description="Recherche titre/description")
    ] = None,
    limit: Annotated[int, Query(ge=1, le=500)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    """Liste les tickets, du plus récent au plus ancien."""
    query = select(Ticket)
    if project_id is not None:
        query = query.where(Ticket.project_id == project_id)
    if status_:
        query = query.where(Ticket.status.in_(status_))
    if assignee_id is not None:
        query = query.where(Ticket.assignee_id == assignee_id)
    if q and q.strip():
        term = q.strip()
        query = query.where(
            or_(
                Ticket.title.icontains(term, autoescape=True),
                Ticket.description.icontains(term, autoescape=True),
            )
        )
    query = query.order_by(Ticket.created_at.desc(), Ticket.id.desc()).limit(limit).offset(offset)
    return db.scalars(query).all()


@router.post("", response_model=TicketOut, status_code=status.HTTP_201_CREATED)
def create_ticket(payload: TicketCreate, db: DbSession, user: CurrentUser):
    get_or_404(db, Project, payload.project_id, "Projet introuvable.")
    ticket = Ticket(**payload.model_dump(), created_by_id=user.id)
    db.add(ticket)
    db.commit()
    return ticket


@router.get("/{ticket_id}", response_model=TicketOut)
def get_ticket(ticket_id: int, db: DbSession, _: CurrentUser):
    return get_or_404(db, Ticket, ticket_id, TICKET_NOT_FOUND)


@router.patch("/{ticket_id}", response_model=TicketOut)
def update_ticket(ticket_id: int, payload: TicketUpdate, db: DbSession, _: CurrentUser):
    """Modifie un ticket : contenu, priorité, statut ou assignation."""
    ticket = get_or_404(db, Ticket, ticket_id, TICKET_NOT_FOUND)
    changes = payload.model_dump(exclude_unset=True)

    if "assignee_id" in changes:
        assignee_id = changes.pop("assignee_id")
        if assignee_id is not None:
            assignee = db.get(User, assignee_id)
            if assignee is None or not assignee.is_active:
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST, detail="Utilisateur à assigner introuvable."
                )
        ticket.assignee_id = assignee_id

    if (new_status := changes.pop("status", None)) is not None:
        ticket.set_status(new_status)

    for field, value in changes.items():
        if value is not None:
            setattr(ticket, field, value)

    db.commit()
    return ticket


@router.delete("/{ticket_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ticket(ticket_id: int, db: DbSession, _: AdminUser) -> None:
    db.delete(get_or_404(db, Ticket, ticket_id, TICKET_NOT_FOUND))
    db.commit()


# --- Commentaires -------------------------------------------------------------


def _get_comment(db: Session, ticket_id: int, comment_id: int) -> Comment:
    comment = db.get(Comment, comment_id)
    if comment is None or comment.ticket_id != ticket_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Commentaire introuvable.")
    return comment


@router.get("/{ticket_id}/comments", response_model=list[CommentOut], tags=["comments"])
def list_comments(ticket_id: int, db: DbSession, _: CurrentUser):
    get_or_404(db, Ticket, ticket_id, TICKET_NOT_FOUND)
    query = (
        select(Comment)
        .where(Comment.ticket_id == ticket_id)
        .order_by(Comment.created_at, Comment.id)
    )
    return db.scalars(query).all()


@router.post(
    "/{ticket_id}/comments",
    response_model=CommentOut,
    status_code=status.HTTP_201_CREATED,
    tags=["comments"],
)
def add_comment(ticket_id: int, payload: CommentWrite, db: DbSession, user: CurrentUser):
    ticket = get_or_404(db, Ticket, ticket_id, TICKET_NOT_FOUND)
    comment = Comment(ticket_id=ticket.id, author_id=user.id, body=payload.body)
    db.add(comment)
    ticket.updated_at = utcnow()
    db.commit()
    return comment


@router.patch("/{ticket_id}/comments/{comment_id}", response_model=CommentOut, tags=["comments"])
def edit_comment(
    ticket_id: int, comment_id: int, payload: CommentWrite, db: DbSession, user: CurrentUser
):
    comment = _get_comment(db, ticket_id, comment_id)
    if comment.author_id != user.id:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="Seul l'auteur peut modifier ce commentaire."
        )
    comment.body = payload.body
    comment.updated_at = utcnow()
    db.commit()
    return comment


@router.delete(
    "/{ticket_id}/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["comments"],
)
def delete_comment(ticket_id: int, comment_id: int, db: DbSession, user: CurrentUser) -> None:
    comment = _get_comment(db, ticket_id, comment_id)
    if comment.author_id != user.id and not user.is_admin:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="Vous ne pouvez pas supprimer ce commentaire."
        )
    db.delete(comment)
    db.commit()
