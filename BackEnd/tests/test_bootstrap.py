import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import Engine, inspect, text
from sqlalchemy.orm import sessionmaker

from app.bootstrap import init_database, run_migrations
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
