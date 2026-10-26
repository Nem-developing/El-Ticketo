from datetime import timedelta

import pytest
from sqlalchemy import update

from app.models import LogEntry, utcnow
from tests.conftest import ADMIN_PASSWORD


def logs(client, headers, **params) -> list[tuple[str | None, str]]:
    response = client.get("/api/logs", params=params, headers=headers)
    assert response.status_code == 200, response.text
    return [(entry["actor"], entry["message"]) for entry in response.json()]


def test_logins_and_account_changes_are_logged(client, admin, member):
    client.post("/api/auth/login", json={"username": "alice", "password": "wrong"})
    alice_id = next(
        user["id"]
        for user in client.get("/api/users", headers=admin).json()
        if user["username"] == "alice"
    )
    client.patch(f"/api/users/{alice_id}", json={"is_admin": True}, headers=admin)
    client.patch(f"/api/users/{alice_id}", json={"is_admin": True}, headers=admin)

    assert logs(client, admin) == [
        ("admin", "« alice » est désormais administrateur"),
        (None, "Échec de connexion pour « alice »"),
        ("alice", "Connexion"),
        ("admin", "Compte « alice » créé (membre)"),
        ("admin", "Connexion"),
    ]
    entry = client.get("/api/logs", params={"limit": 1}, headers=admin).json()[0]
    assert entry["level"] == "info" and entry["ip"] == "testclient"
    assert logs(client, admin, q="Échec") == [(None, "Échec de connexion pour « alice »")]


def test_deletions_and_projects_are_logged(client, admin, make_ticket, project_id):
    ticket = make_ticket(title="Écran noir")
    client.delete(f"/api/tickets/{ticket['id']}", headers=admin)
    client.patch(f"/api/projects/{project_id}", json={"name": "Support"}, headers=admin)

    assert logs(client, admin, limit=2) == [
        ("admin", "Projet « Projet initial » renommé en « Support »"),
        ("admin", f"Ticket #{ticket['id']} « Écran noir » supprimé"),
    ]


def test_server_errors_are_logged(client, admin):
    @client.app.get("/api/boom")
    def boom():
        raise RuntimeError("panne simulée")

    with pytest.raises(RuntimeError):
        client.get("/api/boom")

    entry = client.get("/api/logs", params={"limit": 1}, headers=admin).json()[0]
    assert entry["level"] == "error"
    assert entry["message"] == "Erreur interne sur GET /api/boom : RuntimeError('panne simulée')"


def test_old_entries_are_purged(client, admin):
    with client.app.state.session_factory() as db:
        db.execute(update(LogEntry).values(created_at=utcnow() - timedelta(days=366)))
        db.commit()
    assert logs(client, admin) == []


def test_logs_are_reserved_to_admins(client, member):
    assert client.get("/api/logs", headers=member).status_code == 403


def test_login_with_unknown_user_is_logged_without_actor(client, admin):
    client.post("/api/auth/login", json={"username": "nobody", "password": ADMIN_PASSWORD})
    assert logs(client, admin, limit=1) == [(None, "Échec de connexion pour « nobody »")]
