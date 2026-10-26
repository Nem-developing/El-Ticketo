"""Connexion par SSO (OpenID Connect), voir app/sso.py, et sa configuration par un admin.

Le navigateur part de /login vers le fournisseur d'identité, qui le renvoie sur /callback ;
l'API le ramène alors sur /login avec le token de session dans le fragment de l'adresse
(jamais transmis aux serveurs ni inscrit dans leurs journaux). Le test lancé depuis
l'administration suit le même chemin, sans ouvrir de session ni toucher aux comptes.
"""

import base64
import json
import time
from typing import Annotated, Any
from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Query, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import Settings
from app.deps import AdminUser, DbSession, public_url
from app.journal import record
from app.models import LogLevel, SsoConfig, User
from app.routers.auth import open_session
from app.schemas import SsoConfigOut, SsoConfigWrite, SsoStatus, SsoTestOut, UserOut
from app.security import sign, unsign
from app.sso import SsoError, authorization_url, fetch_claims, new_challenge, username_from_claims
from app.webhooks import Notifier

router = APIRouter(tags=["sso"])

COOKIE = "elticketo_sso"
COOKIE_PATH = "/api/auth/sso"
CHALLENGE_TTL_SECONDS = 600
EXPIRED = "La connexion a expiré, recommencez."
# Le message du fournisseur n'est pas repris : n'importe qui peut forger le lien de retour.
REFUSED = "Connexion refusée par le fournisseur d'identité."


def get_config(db: Session) -> SsoConfig:
    """Configuration enregistrée, ou celle par défaut : SSO désactivé."""
    return db.get(SsoConfig, 1) or SsoConfig(
        id=1, enabled=False, issuer="", client_id="", client_secret=""
    )


def _redirect_uri(request: Request) -> str:
    return public_url(request, "/api/auth/sso/callback")


def _safe_next(path: str) -> str:
    """Page où revenir après la connexion : un chemin local seulement (pas « //autre.site »)."""
    return path if path.startswith("/") and not path.startswith("//") and "\\" not in path else "/"


def _start(request: Request, config: SsoConfig, **extra: Any) -> tuple[str, dict[str, Any]]:
    """Prépare une tentative : adresse du fournisseur et valeurs à garder dans le cookie."""
    challenge = new_challenge()
    url = authorization_url(config, _redirect_uri(request), challenge, refresh="test_by" in extra)
    return url, challenge | extra | {"expires": int(time.time()) + CHALLENGE_TTL_SECONDS}


def _set_cookie(response: Response, request: Request, challenge: dict[str, Any]) -> None:
    response.set_cookie(
        COOKIE,
        sign(base64.urlsafe_b64encode(json.dumps(challenge).encode()).decode()),
        max_age=CHALLENGE_TTL_SECONDS,
        path=COOKIE_PATH,
        httponly=True,
        # « Lax » : le cookie accompagne le retour du fournisseur, une navigation de premier niveau.
        samesite="lax",
        secure=public_url(request, "/").startswith("https://"),
    )


def _read_challenge(request: Request) -> dict[str, Any] | None:
    data = unsign(request.cookies.get(COOKIE, ""))
    if not data:
        return None
    challenge = json.loads(base64.urlsafe_b64decode(data))
    return challenge if challenge["expires"] > time.time() else None


def _back_to(path: str, params: dict[str, str]) -> RedirectResponse:
    response = RedirectResponse(f"{path}#{urlencode(params)}", status_code=status.HTTP_302_FOUND)
    response.delete_cookie(COOKIE, path=COOKIE_PATH)
    return response


# --- Connexion ----------------------------------------------------------------


@router.get("/auth/sso", response_model=SsoStatus)
def sso_status(db: DbSession):
    """Indique si la connexion par SSO est proposée (public)."""
    return SsoStatus(enabled=get_config(db).enabled)


@router.get("/auth/sso/login", response_class=RedirectResponse)
def sso_login(request: Request, db: DbSession, next: Annotated[str, Query(max_length=500)] = "/"):
    """Redirige vers le fournisseur d'identité."""
    config = get_config(db)
    if not config.enabled:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="SSO non configuré.")
    try:
        url, challenge = _start(request, config, next=_safe_next(next))
    except SsoError as exc:
        return _back_to("/login", {"error": str(exc)})
    response = RedirectResponse(url, status_code=status.HTTP_302_FOUND)
    _set_cookie(response, request, challenge)
    return response


@router.get("/auth/sso/callback", response_class=RedirectResponse)
def sso_callback(
    request: Request,
    db: DbSession,
    notifier: Notifier,
    code: Annotated[str | None, Query(max_length=2048)] = None,
    state: Annotated[str | None, Query(max_length=200)] = None,
    error: Annotated[str | None, Query(max_length=200)] = None,
):
    """Retour du fournisseur d'identité : ouvre une session et revient sur l'application."""
    challenge = _read_challenge(request)
    if challenge is None or state != challenge["state"]:
        return _back_to("/login", {"error": EXPIRED})
    config = get_config(db)
    if "test_by" in challenge:
        return _finish_test(request, db, config, challenge, None if error else code)
    if not config.enabled:
        return _back_to("/login", {"error": "La connexion par SSO n'est plus proposée."})

    settings: Settings = request.app.state.settings
    try:
        if error or not code:
            raise SsoError(REFUSED)
        claims = fetch_claims(config, _redirect_uri(request), code, challenge)
        user, username = _match(db, settings, claims)
        if user is not None and not user.is_active:
            raise SsoError(f"Le compte « {username} » est désactivé.")
    except SsoError as exc:
        record(db, f"Échec de connexion SSO : {exc}", request=request, level=LogLevel.WARNING)
        db.commit()
        return _back_to("/login", {"error": str(exc)})

    created = user is None
    if user is None:
        user = User(username=username, password_hash="", sso_subject=str(claims["sub"]))
        db.add(user)
        db.flush()
        record(db, f"Compte « {username} » créé par le SSO", actor=user, request=request)
    elif user.sso_subject is None:
        # Un compte rattaché ne se connecte plus par mot de passe.
        user.sso_subject = str(claims["sub"])
        user.password_hash = ""
        record(db, f"Compte « {username} » rattaché au SSO", actor=user, request=request)

    record(db, "Connexion (SSO)", actor=user, request=request)
    token, _ = open_session(db, user, request)
    db.commit()
    if created:
        text = f"Compte « {user.username} » créé à sa première connexion SSO"
        notifier.send("user.created", text, None, user=UserOut.model_validate(user))
    return _back_to("/login", {"token": token, "next": challenge["next"]})


def _match(db: Session, settings: Settings, claims: dict[str, Any]) -> tuple[User | None, str]:
    """Compte du profil SSO : celui rattaché à ce « sub » ; à défaut celui du même identifiant,
    qui sera rattaché ; sinon (None, identifiant libre) pour un nouveau compte membre.

    Le compte administrateur initial n'est jamais rattaché : il reste un accès de secours par
    mot de passe.
    """
    user = db.scalar(select(User).where(User.sso_subject == str(claims["sub"])))
    if user is not None:
        return user, user.username
    username = username_from_claims(claims)
    user = db.scalar(select(User).where(User.username == username))
    if user is not None and user.sso_subject is None and username != settings.admin_username:
        return user, username
    return None, _free_username(db, username)


def _free_username(db: Session, username: str) -> str:
    """`username`, ou `username-2`, `username-3`… s'il est déjà pris."""
    candidate, number = username, 2
    while db.scalar(select(User.id).where(User.username == candidate)) is not None:
        suffix = f"-{number}"
        candidate, number = username[: 32 - len(suffix)] + suffix, number + 1
    return candidate


# --- Configuration (administrateurs) ------------------------------------------


def _config_out(config: SsoConfig, request: Request) -> SsoConfigOut:
    return SsoConfigOut(
        enabled=config.enabled,
        issuer=config.issuer,
        client_id=config.client_id,
        has_secret=bool(config.client_secret),
        redirect_uri=_redirect_uri(request),
    )


@router.get("/sso", response_model=SsoConfigOut)
def read_config(request: Request, db: DbSession, _: AdminUser):
    """Configuration du SSO, sans le secret du client."""
    return _config_out(get_config(db), request)


@router.put("/sso", response_model=SsoConfigOut)
def write_config(payload: SsoConfigWrite, request: Request, db: DbSession, admin: AdminUser):
    """Enregistre la configuration ; un secret absent (`null`) garde celui enregistré."""
    issuer = payload.issuer.rstrip("/")
    if payload.enabled and not (issuer and payload.client_id):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Renseignez l'émetteur et l'identifiant du client pour activer le SSO.",
        )
    config = db.get(SsoConfig, 1) or SsoConfig(id=1, client_secret="")
    config.enabled, config.issuer, config.client_id = payload.enabled, issuer, payload.client_id
    if payload.client_secret is not None:
        config.client_secret = payload.client_secret
    db.add(config)
    state = "activé" if config.enabled else "désactivé"
    record(db, f"Configuration du SSO enregistrée ({state})", actor=admin, request=request)
    db.commit()
    return _config_out(config, request)


@router.post("/sso/test", response_model=SsoTestOut)
def start_test(request: Request, response: Response, db: DbSession, admin: AdminUser):
    """Prépare un test de la configuration enregistrée, même désactivée : le navigateur suit
    `url` puis revient sur /admin/sso avec le résultat, sans session ouverte ni compte modifié."""
    config = get_config(db)
    if not (config.issuer and config.client_id):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Enregistrez l'émetteur et l'identifiant du client avant de tester.",
        )
    try:
        url, challenge = _start(request, config, test_by=admin.id)
    except SsoError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from None
    _set_cookie(response, request, challenge)
    return SsoTestOut(url=url)


def _finish_test(
    request: Request, db: Session, config: SsoConfig, challenge: dict[str, Any], code: str | None
) -> RedirectResponse:
    admin = db.get(User, challenge["test_by"])
    try:
        if not code:
            raise SsoError(REFUSED)
        claims = fetch_claims(config, _redirect_uri(request), code, challenge)
        message, result = _describe(db, request.app.state.settings, claims), "ok"
    except SsoError as exc:
        message, result = str(exc), "error"
    level = LogLevel.INFO if result == "ok" else LogLevel.WARNING
    record(db, f"Test du SSO : {message}", actor=admin, request=request, level=level)
    db.commit()
    return _back_to("/admin/sso", {"test": result, "message": message})


def _describe(db: Session, settings: Settings, claims: dict[str, Any]) -> str:
    """Ce que donnerait une vraie connexion avec ce profil."""
    identity = claims.get("preferred_username") or claims.get("email") or claims["sub"]
    user, username = _match(db, settings, claims)
    if user is None:
        outcome = f"un compte membre « {username} » sera créé à la première connexion"
    elif user.sso_subject is None:
        outcome = f"le compte existant « {username} » sera rattaché au SSO à la première connexion"
    else:
        outcome = f"compte « {username} », déjà rattaché au SSO"
    if user is not None and not user.is_active:
        outcome += " (désactivé : la connexion sera refusée)"
    return f"« {identity} » authentifié ; {outcome}."
