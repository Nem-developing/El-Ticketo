"""Pièces jointes : envoyées telles quelles dans le corps de la requête, stockées en base."""

from collections.abc import Iterator
from itertools import count
from typing import Annotated
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse
from sqlalchemy import insert, select
from sqlalchemy.orm import Session, sessionmaker

from app.deps import CurrentUser, DbSession, get_or_404
from app.models import Attachment, AttachmentChunk, Ticket
from app.schemas import AttachmentOut
from app.security import is_valid_attachment_link

router = APIRouter(tags=["attachments"])

MAX_SIZE = 1024**3
# Une fois échappé par PyMySQL, un morceau peut doubler : 4 Mo tiennent dans les 16 Mo que
# MariaDB accepte par requête.
CHUNK_SIZE = 4 * 1024**2
# Types que le navigateur peut afficher sans risque ; les autres sont servis en binaire brut.
IMAGE_TYPES = {"image/png", "image/jpeg", "image/gif", "image/webp"}
NOT_FOUND = "Pièce jointe introuvable."


def get_ticket(ticket_id: int, db: DbSession) -> Ticket:
    return get_or_404(db, Ticket, ticket_id, "Ticket introuvable.")


TicketDep = Annotated[Ticket, Depends(get_ticket)]


@router.get("/tickets/{ticket_id}/attachments", response_model=list[AttachmentOut])
def list_attachments(_: CurrentUser, ticket: TicketDep, db: DbSession):
    query = (
        select(Attachment)
        .where(Attachment.ticket_id == ticket.id)
        .order_by(Attachment.created_at, Attachment.id)
    )
    return db.scalars(query).all()


@router.post(
    "/tickets/{ticket_id}/attachments",
    response_model=AttachmentOut,
    status_code=status.HTTP_201_CREATED,
)
async def upload_attachment(
    user: CurrentUser,
    ticket: TicketDep,
    name: Annotated[str, Query(min_length=1, max_length=200, description="Nom du fichier")],
    request: Request,
    db: DbSession,
):
    """Joint le fichier envoyé dans le corps de la requête (1 Go au plus).

    Le fichier est enregistré morceau par morceau, sans jamais passer en entier en mémoire, et
    dans une seule transaction : un envoi interrompu ou refusé ne laisse rien en base.
    """
    # Taille annoncée par le navigateur : inutile de recevoir 1 Go pour le refuser ensuite.
    if int(request.headers.get("content-length") or 0) > MAX_SIZE:
        raise _too_large()

    content_type = request.headers.get("content-type", "").split(";")[0].strip().lower()
    attachment = Attachment(
        ticket_id=ticket.id,
        uploaded_by_id=user.id,
        filename=name.strip() or "fichier",
        content_type=content_type[:100] or "application/octet-stream",
        size=0,
    )
    await run_in_threadpool(_add, db, attachment)

    size, position, buffer = 0, 0, bytearray()
    async for received in request.stream():
        size += len(received)
        if size > MAX_SIZE:
            raise _too_large()
        buffer += received
        while len(buffer) >= CHUNK_SIZE:
            await run_in_threadpool(_store_chunk, db, attachment.id, position, buffer[:CHUNK_SIZE])
            del buffer[:CHUNK_SIZE]
            position += 1
    if size == 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Le fichier est vide.")
    if buffer:
        await run_in_threadpool(_store_chunk, db, attachment.id, position, buffer)
    attachment.size = size
    return await run_in_threadpool(_commit, db, attachment)


def _too_large() -> HTTPException:
    return HTTPException(
        status.HTTP_413_CONTENT_TOO_LARGE, detail="Fichier trop volumineux (1 Go maximum)."
    )


def _add(db: Session, attachment: Attachment) -> None:
    db.add(attachment)
    db.flush()


def _store_chunk(db: Session, attachment_id: int, position: int, data: bytearray) -> None:
    chunk = {"attachment_id": attachment_id, "position": position, "data": bytes(data)}
    db.execute(insert(AttachmentChunk).values(chunk))


def _commit(db: Session, attachment: Attachment) -> AttachmentOut:
    db.commit()
    return AttachmentOut.model_validate(attachment)


@router.get("/attachments/{attachment_id}/file", response_class=StreamingResponse)
def download_attachment(
    attachment_id: int, expires: int, signature: str, request: Request, db: DbSession
):
    """Contenu du fichier, par le lien signé (`url`) que donne la liste des pièces jointes."""
    if not is_valid_attachment_link(attachment_id, expires, signature):
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Lien expiré ou invalide.")
    attachment = get_or_404(db, Attachment, attachment_id, NOT_FOUND)
    image = attachment.content_type in IMAGE_TYPES
    return StreamingResponse(
        _read_chunks(request.app.state.session_factory, attachment.id),
        media_type=attachment.content_type if image else "application/octet-stream",
        headers={
            "Content-Disposition": f"attachment; filename*=UTF-8''{quote(attachment.filename)}",
            "Content-Length": str(attachment.size),
            "X-Content-Type-Options": "nosniff",
        },
    )


def _read_chunks(session_factory: sessionmaker[Session], attachment_id: int) -> Iterator[bytes]:
    # Session à part : les morceaux sont lus pendant l'envoi, après la fin de la fonction de route.
    with session_factory() as db:
        for position in count():
            data = db.scalar(
                select(AttachmentChunk.data).where(
                    AttachmentChunk.attachment_id == attachment_id,
                    AttachmentChunk.position == position,
                )
            )
            if data is None:
                return
            yield data


@router.delete("/attachments/{attachment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attachment(attachment_id: int, db: DbSession, user: CurrentUser) -> None:
    attachment = get_or_404(db, Attachment, attachment_id, NOT_FOUND)
    if attachment.uploaded_by_id != user.id and not user.is_admin:
        raise HTTPException(
            status.HTTP_403_FORBIDDEN, detail="Vous ne pouvez pas supprimer cette pièce jointe."
        )
    db.delete(attachment)
    db.commit()
