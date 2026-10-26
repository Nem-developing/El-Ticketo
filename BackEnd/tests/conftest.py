import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.config import Settings
from app.database import Base, create_db_engine
from app.main import create_app

# SQLite en mémoire par défaut ; définir TEST_DATABASE_URL pour viser une vraie MariaDB.
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "sqlite://")
ADMIN_PASSWORD = "admin-password"
MEMBER_PASSWORD = "alice-password"


def login(client: TestClient, username: str, password: str) -> dict[str, str]:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


@pytest.fixture
def settings() -> Settings:
    return Settings(database_url=TEST_DATABASE_URL, admin_password=ADMIN_PASSWORD, cors_origins=[])


@pytest.fixture
def client(settings):
    if not TEST_DATABASE_URL.startswith("sqlite"):
        engine = create_db_engine(TEST_DATABASE_URL)
        Base.metadata.drop_all(engine)
        with engine.begin() as connection:
            connection.execute(text("DROP TABLE IF EXISTS alembic_version"))
        engine.dispose()

    with TestClient(create_app(settings)) as test_client:
        yield test_client


@pytest.fixture
def admin(client) -> dict[str, str]:
    return login(client, "admin", ADMIN_PASSWORD)


@pytest.fixture
def member(client, admin) -> dict[str, str]:
    response = client.post(
        "/api/users", json={"username": "alice", "password": MEMBER_PASSWORD}, headers=admin
    )
    assert response.status_code == 201, response.text
    return login(client, "alice", MEMBER_PASSWORD)


@pytest.fixture
def project_id(client, admin) -> int:
    return client.get("/api/projects", headers=admin).json()[0]["id"]


@pytest.fixture
def make_ticket(client, admin, project_id):
    def _make_ticket(headers: dict[str, str] | None = None, **fields) -> dict:
        payload = {"project_id": project_id, "title": "Imprimante HS", "category": "Matériel"}
        payload.update(fields)
        response = client.post("/api/tickets", json=payload, headers=headers or admin)
        assert response.status_code == 201, response.text
        return response.json()

    return _make_ticket
