"""Point d'entrée de l'API : `uvicorn app.main:create_app --factory`."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import sessionmaker

from app import __version__
from app.bootstrap import init_database
from app.config import Settings
from app.database import create_db_engine
from app.journal import record
from app.models import LogLevel
from app.routers import ROUTERS
from app.throttle import LoginThrottle

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    engine = create_db_engine(settings.database_url)
    session_factory = sessionmaker(bind=engine, autoflush=False)

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        init_database(engine, session_factory, settings)
        yield
        engine.dispose()

    logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(name)s - %(message)s")

    app = FastAPI(
        title="El Ticketo API",
        version=__version__,
        description="API de gestion de tickets, simple et sans fioritures.",
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
    )
    app.state.settings = settings
    app.state.session_factory = session_factory
    app.state.login_throttle = LoginThrottle(
        max_attempts=settings.login_max_attempts,
        window_seconds=settings.login_lockout_minutes * 60,
    )

    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_methods=["*"],
            allow_headers=["*"],
        )

    @app.exception_handler(Exception)
    def log_server_error(request: Request, exc: Exception) -> JSONResponse:
        """Erreur inattendue : inscrite au journal, pour que l'admin la voie sans lire les logs
        du conteneur (la trace complète y reste)."""
        try:
            with session_factory() as db:
                message = f"Erreur interne sur {request.method} {request.url.path} : {exc!r}"
                record(db, message, request=request, level=LogLevel.ERROR)
                db.commit()
        except SQLAlchemyError:
            logger.exception("Impossible d'inscrire l'erreur au journal.")
        return JSONResponse({"detail": "Erreur interne du serveur."}, status_code=500)

    for router in ROUTERS:
        app.include_router(router, prefix="/api")

    return app
