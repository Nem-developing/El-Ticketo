"""Connexion par SSO (OpenID Connect), voir app/sso.py.

Le navigateur part de /login vers le fournisseur d'identité, qui le renvoie sur /callback ;
l'API le ramène alors sur /login avec le token de session dans le fragment de l'adresse
(jamais transmis aux serveurs ni inscrit dans leurs journaux).
"""

import base64
import json
import time
from typing import Annotated, Any
from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.deps import DbSession, public_url
from app.journal import record
from app.models import LogLevel, User
from app.routers.auth import open_session
from app.schemas import SsoStatus, UserOut
from app.security import sign, unsign
from app.sso import SsoError, authorization_url, fetch_claims, new_challenge, username_from_claims
from app.webhooks import Notifier

router = APIRouter(prefix="/auth/sso", tags=["auth"])

COOKIE = "elticketo_sso"
COOKIE_PATH = "/api/auth/sso"
CHALLENGE_TTL_SECONDS = 600


def _redirect_uri(request: Request) -> str:
    return public_url(request, "/api/auth/sso/callback")


def _safe_next(path: str) -> str:
    """Page où revenir après la connexion : un chemin local seulement (pas « //autre.site »)."""
    return path if path.startswith("/") and not path.startswith("//") and "\\" not in path else "/"


def _read_challenge(request: Request) -> dict[str, Any] | None:
    data = unsign(request.cookies.get(COOKIE, ""))
    if not data:
        return None
    challenge = json.loads(base64.urlsafe_b64decode(data))
    return challenge if challenge["expires"] > time.time() else None


def _back_to_login(params: dict[str, str]) -> RedirectResponse:
    response = RedirectResponse(f"/login#{urlencode(params)}", status_code=status.HTTP_302_FOUND)
    response.delete_cookie(COOKIE, path=COOKIE_PATH)
    return response


@router.get("", response_model=SsoStatus)
def sso_status(request: Request):
    """Indique si la connexion par SSO est proposée (public)."""
    return SsoStatus(enabled=request.app.state.settings.sso_enabled)


@router.get("/login", response_class=RedirectResponse, status_code=status.HTTP_302_FOUND)
def sso_login(request: Request, next: Annotated[str, Query(max_length=500)] = "/"):
    """Redirige vers le fournisseur d'identité."""
    settings: Settings = request.app.state.settings
    if not settings.sso_enabled:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="SSO non configuré.")
    challenge = new_challenge()
    try:
        url = authorization_url(settings, _redirect_uri(request), challenge)
    except SsoError as exc:
        return _back_to_login({"error": str(exc)})

    challenge |= {"next": _safe_next(next), "expires": int(time.time()) + CHALLENGE_TTL_SECONDS}
    cookie = sign(base64.urlsafe_b64encode(json.dumps(challenge).encode()).decode())
    response = RedirectResponse(url, status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        COOKIE,
        cookie,
        max_age=CHALLENGE_TTL_SECONDS,
        path=COOKIE_PATH,
        httponly=True,
        # « Lax » : le cookie accompagne le retour du fournisseur, une navigation de premier niveau.
        samesite="lax",
        secure=public_url(request, "/").startswith("https://"),
    )
    return response


@router.get("/callback", response_class=RedirectResponse, status_code=status.HTTP_302_FOUND)
def sso_callback(
    request: Request,
    db: DbSession,
    notifier: Notifier,
    code: Annotated[str | None, Query(max_length=2048)] = None,
    state: Annotated[str | None, Query(max_length=200)] = None,
    error: Annotated[str | None, Query(max_length=200)] = None,
):
    """Retour du fournisseur d'identité : ouvre une session et revient sur l'application."""
    settings: Settings = request.app.state.settings
    challenge = _read_challenge(request)
    if not settings.sso_enabled or challenge is None or state != challenge["state"]:
        return _back_to_login({"error": "La connexion a expiré, recommencez."})

    try:
        if error or not code:
            # Le message du fournisseur n'est pas repris : n'importe qui peut forger ce lien.
            raise SsoError("Connexion refusée par le fournisseur d'identité.")
        claims = fetch_claims(settings, _redirect_uri(request), code, challenge)
        user, created = _find_or_create_user(db, settings, claims, request)
        if not user.is_active:
            raise SsoError(f"Le compte « {user.username} » est désactivé.")
    except SsoError as exc:
        db.rollback()
        record(db, f"Échec de connexion SSO : {exc}", request=request, level=LogLevel.WARNING)
        db.commit()
        return _back_to_login({"error": str(exc)})

    record(db, "Connexion (SSO)", actor=user, request=request)
    token, _ = open_session(db, user, request)
    db.commit()
    if created:
        text = f"Compte « {user.username} » créé à sa première connexion SSO"
        notifier.send("user.created", text, None, user=UserOut.model_validate(user))
    return _back_to_login({"token": token, "next": challenge["next"]})


def _find_or_create_user(
    db: Session, settings: Settings, claims: dict[str, Any], request: Request
) -> tuple[User, bool]:
    """Compte rattaché à ce « sub » ; à défaut, le compte du même identifiant, qui passe au
    SSO ; sinon un nouveau compte membre. Le compte administrateur initial n'est jamais
    rattaché : il reste un accès de secours par mot de passe."""
    subject = str(claims["sub"])
    user = db.scalar(select(User).where(User.sso_subject == subject))
    if user is not None:
        return user, False

    username = username_from_claims(claims)
    user = db.scalar(select(User).where(User.username == username))
    if user is not None and user.sso_subject is None and username != settings.admin_username:
        user.sso_subject = subject
        user.password_hash = ""
        record(db, f"Compte « {username} » rattaché au SSO", actor=user, request=request)
        return user, False

    user = User(username=_free_username(db, username), password_hash="", sso_subject=subject)
    db.add(user)
    db.flush()
    record(db, f"Compte « {user.username} » créé par le SSO", actor=user, request=request)
    return user, True


def _free_username(db: Session, username: str) -> str:
    """`username`, ou `username-2`, `username-3`… s'il est déjà pris."""
    candidate, number = username, 2
    while db.scalar(select(User.id).where(User.username == candidate)) is not None:
        suffix = f"-{number}"
        candidate, number = username[: 32 - len(suffix)] + suffix, number + 1
    return candidate
