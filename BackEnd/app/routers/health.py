from fastapi import APIRouter, Response, status
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app import __version__
from app.deps import DbSession
from app.schemas import HealthOut

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthOut)
def health(db: DbSession, response: Response):
    """État de l'API et de sa connexion à la base (public, utilisable en healthcheck)."""
    try:
        db.execute(text("SELECT 1"))
        database_ok = True
    except SQLAlchemyError:
        database_ok = False
    if not database_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
    return HealthOut(
        status="ok" if database_ok else "degraded",
        version=__version__,
        database="ok" if database_ok else "error",
    )
