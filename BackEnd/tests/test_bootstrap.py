import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from sqlalchemy import Engine, inspect, text
from sqlalchemy.orm import sessionmaker

from app.bootstrap import MIGRATIONS_DIR, init_database, run_migrations
from app.config import Settings
from app.database import Base, create_db_engine

SETTINGS = Settings(database_url="sqlite://")


def test_migrations_match_the_models():
    """Toute modification des modèles doit s'accompagner d'une migration."""
    engine = create_db_engine("sqlite://")
    run_migrations(engine)
    with engine.connect() as connection:
        context = MigrationContext.configure(connection, opts={"compare_type": True})
        assert compare_metadata(context, Base.metadata) == []


def test_sqlite_migrations_keep_rows_of_recreated_tables():
    """Recréer `attachments` (migration 0003) ne doit pas effacer le contenu des fichiers."""
    engine = create_db_engine("sqlite://")
    config = Config()
    config.set_main_option("script_location", str(MIGRATIONS_DIR))
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "0002")
        for statement in (
            "INSERT INTO users VALUES (1, 'admin', '', 1, 1, '2026-01-01')",
            "INSERT INTO projects VALUES (1, 'Projet', '', '2026-01-01')",
            "INSERT INTO tickets (id, project_id, title, description, category, priority, status,"
            " created_by_id, created_at, updated_at)"
            " VALUES (1, 1, 'Titre', '', 'Bug', 'normal', 'new', 1, '2026-01-01', '2026-01-01')",
            "INSERT INTO attachments (id, ticket_id, uploaded_by_id, filename, content_type, size,"
            " created_at) VALUES (1, 1, 1, 'a.txt', 'text/plain', 3, '2026-01-01')",
            "INSERT INTO attachment_chunks VALUES (1, 0, x'616263')",
        ):
            connection.execute(text(statement))

    run_migrations(engine)

    with engine.connect() as connection:
        assert connection.execute(text("SELECT COUNT(*) FROM attachment_chunks")).scalar() == 1
        assert connection.execute(text("PRAGMA foreign_keys")).scalar() == 1


def _create_v3_schema(engine: Engine) -> None:
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE tickets (id INTEGER PRIMARY KEY, titre VARCHAR(50))"))


@pytest.mark.parametrize(
    "create_old_schema",
    [_create_v3_schema, Base.metadata.create_all],
    ids=["schema-v3", "schema-sans-migrations"],
)
def test_startup_refuses_a_database_without_migration_history(create_old_schema):
    engine = create_db_engine("sqlite://")
    create_old_schema(engine)

    with pytest.raises(RuntimeError, match="ancienne version"):
        init_database(engine, sessionmaker(bind=engine), SETTINGS)


def test_seed_runs_only_once():
    engine = create_db_engine("sqlite://")
    session_factory = sessionmaker(bind=engine)

    init_database(engine, session_factory, SETTINGS)
    init_database(engine, session_factory, SETTINGS)

    assert "alembic_version" in inspect(engine).get_table_names()
    with engine.connect() as connection:
        assert connection.execute(text("SELECT COUNT(*) FROM users")).scalar() == 1
        assert connection.execute(text("SELECT COUNT(*) FROM tickets")).scalar() == 1
