"""Initialisation au démarrage : attente de la base, migrations, données initiales."""

import logging
import time
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import Connection, Engine, func, inspect, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import Session, sessionmaker

from app import notifications
from app.config import Settings
from app.journal import purge
from app.models import Project, Ticket, User
from app.security import hash_password

logger = logging.getLogger(__name__)

MIGRATIONS_DIR = Path(__file__).parent / "migrations"

WELCOME_DESCRIPTION = (
    "Bienvenue ! Ce ticket d'exemple montre le fonctionnement de l'outil : "
    "commentez-le, changez son statut, assignez-le… puis fermez-le."
)


def init_database(
    engine: Engine, session_factory: sessionmaker[Session], settings: Settings
) -> None:
    wait_for_database(engine)
    run_migrations(engine)
    with session_factory() as db:
        _seed_first_run(db, settings)
        purge(db)
        notifications.purge(db)
        db.commit()


def wait_for_database(engine: Engine, attempts: int = 30, delay: float = 2.0) -> None:
    """Au lancement via docker compose, la base peut démarrer après l'API."""
    for attempt in range(1, attempts + 1):
        try:
            with engine.connect():
                return
        except OperationalError as exc:
            if attempt == attempts:
                raise
            logger.warning(
                "Base de données injoignable (essai %d/%d) : %s", attempt, attempts, exc.orig
            )
            time.sleep(delay)


def run_migrations(engine: Engine) -> None:
    """Amène le schéma à la dernière version (migrations Alembic de app/migrations)."""
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    with engine.connect() as connection:
        # SQLite recrée une table pour la modifier : supprimer l'ancienne effacerait, par cascade,
        # les lignes qui la référencent. Les clés étrangères sont donc suspendues le temps des
        # migrations (le PRAGMA n'a d'effet qu'en dehors d'une transaction).
        sqlite = connection.dialect.name == "sqlite"
        if sqlite:
            connection.exec_driver_sql("PRAGMA foreign_keys=OFF")
            connection.commit()
        try:
            with connection.begin():
                config.attributes["connection"] = connection
                _reject_unmanaged_schema(connection)
                command.upgrade(config, "head")
        finally:
            if sqlite:
                connection.exec_driver_sql("PRAGMA foreign_keys=ON")
                connection.commit()


def _reject_unmanaged_schema(connection: Connection) -> None:
    """Refuse une base qui contient déjà des tables sans historique de migrations
    (El Ticketo avant la 3.0, ou base de développement)."""
    inspector = inspect(connection)
    if inspector.has_table("alembic_version") or not inspector.has_table("tickets"):
        return
    raise RuntimeError(
        "La base contient des tables El Ticketo d'une ancienne version (sans migrations), "
        "incompatibles avec celle-ci. Démarrez sur une base vide (ex. `docker compose down -v`)."
    )


def _seed_first_run(db: Session, settings: Settings) -> None:
    if db.scalar(select(func.count()).select_from(User)):
        return

    admin = User(
        username=settings.admin_username.lower(),
        password_hash=hash_password(settings.admin_password),
        is_admin=True,
    )
    project = Project(
        name="Projet initial", description="Premier projet, renommez-le à votre guise."
    )
    db.add_all([admin, project])
    db.flush()
    db.add(
        Ticket(
            project_id=project.id,
            created_by_id=admin.id,
            title="Bienvenue sur El Ticketo !",
            description=WELCOME_DESCRIPTION,
            category="Autre",
        )
    )
    db.commit()

    logger.info("Premier démarrage : compte administrateur « %s » créé.", admin.username)
    if settings.admin_password == "admin":
        logger.warning(
            "Le mot de passe administrateur par défaut est utilisé : changez-le dès la "
            "première connexion (ou définissez ADMIN_PASSWORD avant le premier démarrage)."
        )
