from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, select

from app.deps import AdminUser, CurrentUser, DbSession, commit_or_conflict, get_or_404
from app.models import ApiToken, User
from app.schemas import UserCreate, UserOut, UserUpdate
from app.security import hash_password

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(db: DbSession, _: CurrentUser):
    return db.scalars(select(User).order_by(User.username)).all()


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: DbSession, _: AdminUser):
    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        is_admin=payload.is_admin,
    )
    db.add(user)
    commit_or_conflict(db, "Ce nom d'utilisateur est déjà pris.")
    return user


@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: UserUpdate, db: DbSession, admin: AdminUser):
    """Réinitialise le mot de passe, change le rôle ou (dés)active un compte."""
    user = get_or_404(db, User, user_id, "Utilisateur introuvable.")
    if user.id == admin.id and (payload.is_admin is False or payload.is_active is False):
        # Garantit qu'il reste toujours au moins un administrateur actif.
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail="Vous ne pouvez pas retirer vos propres droits ni désactiver votre compte.",
        )

    revoke_sessions = False
    if payload.password is not None:
        user.password_hash = hash_password(payload.password)
        revoke_sessions = True
    if payload.is_admin is not None:
        user.is_admin = payload.is_admin
    if payload.is_active is not None:
        user.is_active = payload.is_active
        revoke_sessions = revoke_sessions or not payload.is_active

    if revoke_sessions:
        db.execute(delete(ApiToken).where(ApiToken.user_id == user.id))
    db.commit()
    return user
