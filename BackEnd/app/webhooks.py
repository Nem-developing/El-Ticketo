"""Webhooks : à chaque événement choisi, un POST JSON est envoyé aux adresses abonnées.

Le corps contient `event`, `created_at`, `actor`, `text` puis l'objet concerné (`ticket`,
`comment`, `user`…). `text` résume l'événement en une phrase : Slack, Mattermost ou Rocket.Chat
l'affichent tel quel. L'envoi a lieu après la réponse, sans nouvel essai ; un échec est inscrit
au journal.
"""

import http.client
import json
import urllib.error
import urllib.request
from typing import Annotated, Any
from urllib.parse import urlsplit

from fastapi import BackgroundTasks, Depends, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app import __version__
from app.deps import DbSession, public_url
from app.journal import record
from app.models import LogLevel, User, Webhook, utcnow

TIMEOUT_SECONDS = 5


def post_json(url: str, payload: dict[str, Any]) -> str | None:
    """Envoie le POST ; renvoie la cause de l'échec, ou None s'il a réussi."""
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "User-Agent": f"ElTicketo/{__version__}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS):
            return None
    except urllib.error.HTTPError as exc:
        return f"réponse HTTP {exc.code}"
    except urllib.error.URLError as exc:
        return str(exc.reason)
    except (OSError, ValueError, http.client.HTTPException) as exc:
        return str(exc) or type(exc).__name__


def host(url: str) -> str:
    """Hôte seul : le chemin d'une adresse de webhook contient souvent un secret."""
    return urlsplit(url).netloc or url


def _deliver(session_factory: sessionmaker[Session], url: str, payload: dict[str, Any]) -> None:
    if error := post_json(url, payload):
        with session_factory() as db:
            message = f"Webhook « {payload['event']} » vers {host(url)} en échec : {error}"
            record(db, message, level=LogLevel.WARNING)
            db.commit()


def make_payload(event: str, text: str, actor: User | None, **data: Any) -> dict[str, Any]:
    payload = {
        "event": event,
        "created_at": utcnow().isoformat(),
        "actor": actor.username if actor else None,
        "text": text,
    }
    for key, value in data.items():
        payload[key] = value.model_dump(mode="json") if isinstance(value, BaseModel) else value
    return payload


class _Notifier:
    """Programme l'appel des webhooks abonnés à un événement, une fois la réponse envoyée.

    À appeler après `db.commit()` : les données envoyées sont alors définitives.
    """

    def __init__(self, request: Request, background: BackgroundTasks, db: DbSession) -> None:
        self.request = request
        self.background = background
        self.db = db

    def page_url(self, path: str) -> str:
        return public_url(self.request, path)

    def send(self, event: str, text: str, actor: User | None, **data: Any) -> None:
        hooks = [h for h in self.db.scalars(select(Webhook)) if event in h.events.split(",")]
        if not hooks:
            return
        payload = make_payload(event, text, actor, **data)
        session_factory = self.request.app.state.session_factory
        for hook in hooks:
            self.background.add_task(_deliver, session_factory, hook.url, payload)


Notifier = Annotated[_Notifier, Depends()]
