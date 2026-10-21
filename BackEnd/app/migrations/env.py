"""Environnement Alembic : applique les migrations sur la connexion fournie par l'API,
ou sur la base configurée par les variables d'environnement (commande `alembic`)."""

from alembic import context
from sqlalchemy import Connection

from app import models  # noqa: F401  (enregistre les tables dans Base.metadata)
from app.config import Settings
from app.database import Base, create_db_engine


def _run(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=Base.metadata,
        compare_type=True,
        # SQLite ne sait pas modifier une table en place : Alembic la recrée.
        render_as_batch=connection.dialect.name == "sqlite",
    )
    with context.begin_transaction():
        context.run_migrations()


connection = context.config.attributes.get("connection")
if connection is not None:
    _run(connection)
else:
    engine = create_db_engine(Settings().database_url)
    with engine.connect() as new_connection:
        _run(new_connection)
    engine.dispose()
