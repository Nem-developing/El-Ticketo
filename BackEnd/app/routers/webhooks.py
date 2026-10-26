from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import select

from app.deps import AdminUser, DbSession, get_or_404
from app.journal import record
from app.models import Webhook
from app.schemas import WebhookOut, WebhookWrite
from app.webhooks import host, make_payload, post_json

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

NOT_FOUND = "Webhook introuvable."


def _events(payload: WebhookWrite) -> str:
    return ",".join(dict.fromkeys(payload.events))


@router.get("", response_model=list[WebhookOut])
def list_webhooks(db: DbSession, _: AdminUser):
    return db.scalars(select(Webhook).order_by(Webhook.id)).all()


@router.post("", response_model=WebhookOut, status_code=status.HTTP_201_CREATED)
def create_webhook(payload: WebhookWrite, db: DbSession, admin: AdminUser, request: Request):
    webhook = Webhook(url=payload.url, events=_events(payload))
    db.add(webhook)
    record(db, f"Webhook vers {host(webhook.url)} ajouté", actor=admin, request=request)
    db.commit()
    return webhook


@router.put("/{webhook_id}", response_model=WebhookOut)
def update_webhook(
    webhook_id: int, payload: WebhookWrite, db: DbSession, admin: AdminUser, request: Request
):
    webhook = get_or_404(db, Webhook, webhook_id, NOT_FOUND)
    webhook.url = payload.url
    webhook.events = _events(payload)
    record(db, f"Webhook vers {host(webhook.url)} modifié", actor=admin, request=request)
    db.commit()
    return webhook


@router.delete("/{webhook_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_webhook(webhook_id: int, db: DbSession, admin: AdminUser, request: Request) -> None:
    webhook = get_or_404(db, Webhook, webhook_id, NOT_FOUND)
    db.delete(webhook)
    record(db, f"Webhook vers {host(webhook.url)} supprimé", actor=admin, request=request)
    db.commit()


@router.post("/{webhook_id}/test", status_code=status.HTTP_204_NO_CONTENT)
def test_webhook(webhook_id: int, db: DbSession, admin: AdminUser) -> None:
    """Envoie tout de suite un événement `ping`, pour vérifier l'adresse."""
    webhook = get_or_404(db, Webhook, webhook_id, NOT_FOUND)
    if error := post_json(webhook.url, make_payload("ping", "Test du webhook El Ticketo", admin)):
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=f"Échec de l'appel : {error}.")
