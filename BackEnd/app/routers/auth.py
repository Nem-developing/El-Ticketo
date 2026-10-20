from datetime import timedelta
from math import ceil

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import delete, select

from app.deps import CurrentToken, CurrentUser, DbSession
from app.models import ApiToken, User, utcnow
from app.schemas import LoginRequest, LoginResponse, PasswordChange, UserOut
from app.security import (
    DUMMY_PASSWORD_HASH,
    generate_token,
    hash_password,
    hash_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(payload: LoginRequest, db: DbSession, request: Request):
    """Ouvre une session et renvoie un token à passer dans `Authorization: Bearer <token>`."""
    username = payload.username.strip().lower()
    client_ip = request.client.host if request.client else "inconnue"
    throttle_key = f"{client_ip}|{username}"
    throttle = request.app.state.login_throttle

    if wait := throttle.acquire(throttle_key):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Trop de tentatives. Réessayez dans {ceil(wait / 60)} min.",
            headers={"Retry-After": str(wait)},
        )

    user = db.scalar(select(User).where(User.username == username))
    password_ok = verify_password(
        payload.password, user.password_hash if user else DUMMY_PASSWORD_HASH
    )
    if user is None or not password_ok or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Identifiants incorrects.")
    throttle.reset(throttle_key)

    now = utcnow()
    db.execute(delete(ApiToken).where(ApiToken.user_id == user.id, ApiToken.expires_at <= now))
    token = generate_token()
    expires_at = now + timedelta(hours=request.app.state.settings.token_ttl_hours)
    db.add(ApiToken(user_id=user.id, token_hash=hash_token(token), expires_at=expires_at))
    db.commit()
    return LoginResponse(
        access_token=token, expires_at=expires_at, user=UserOut.model_validate(user)
    )


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(token: CurrentToken, db: DbSession) -> None:
    db.delete(token)
    db.commit()


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user


@router.put("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_my_password(payload: PasswordChange, token: CurrentToken, db: DbSession) -> None:
    """Change son propre mot de passe et ferme ses autres sessions."""
    user = token.user
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Mot de passe actuel incorrect.")
    user.password_hash = hash_password(payload.new_password)
    db.execute(delete(ApiToken).where(ApiToken.user_id == user.id, ApiToken.id != token.id))
    db.commit()
