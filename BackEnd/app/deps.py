"""Dépendances FastAPI partagées : session DB, utilisateur courant, contrôle admin."""

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import ApiToken, User, utcnow
from app.security import hash_token

DbSession = Annotated[Session, Depends(get_db)]

_bearer = HTTPBearer(auto_error=False)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status.HTTP_401_UNAUTHORIZED, detail=detail, headers={"WWW-Authenticate": "Bearer"}
    )


def get_current_token(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> ApiToken:
    if credentials is None:
        raise _unauthorized("Authentification requise.")
    token = db.scalar(
        select(ApiToken).where(ApiToken.token_hash == hash_token(credentials.credentials))
    )
    if token is None or token.expires_at <= utcnow() or not token.user.is_active:
        raise _unauthorized("Session invalide ou expirée.")
    return token


CurrentToken = Annotated[ApiToken, Depends(get_current_token)]


def get_current_user(token: CurrentToken) -> User:
    return token.user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_admin(user: CurrentUser) -> User:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, detail="Réservé aux administrateurs.")
    return user


AdminUser = Annotated[User, Depends(require_admin)]


def public_url(request: Request, path: str) -> str:
    """Adresse publique d'une page : PUBLIC_URL, sinon déduite de la requête."""
    base = request.app.state.settings.public_url or str(request.base_url)
    return base.rstrip("/") + path


def get_or_404[T](db: Session, model: type[T], object_id: int, detail: str) -> T:
    obj = db.get(model, object_id)
    if obj is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=detail)
    return obj


def commit_or_conflict(db: Session, detail: str) -> None:
    """Valide la transaction ; une contrainte d'unicité violée devient une erreur 409."""
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, detail=detail) from None
