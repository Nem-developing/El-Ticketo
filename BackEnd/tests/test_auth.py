from datetime import timedelta

from sqlalchemy import update

from app.models import ApiToken, utcnow
from tests.conftest import ADMIN_PASSWORD, MEMBER_PASSWORD, login


def test_health_is_public(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["database"] == "ok"


def test_first_run_seeds_admin_project_and_welcome_ticket(client, admin):
    me = client.get("/api/auth/me", headers=admin).json()
    assert me["username"] == "admin"
    assert me["is_admin"] is True
    assert len(client.get("/api/projects", headers=admin).json()) == 1
    assert len(client.get("/api/tickets", headers=admin).json()) == 1


def test_login_rejects_bad_credentials(client):
    for username, password in [("admin", "wrong"), ("nobody", ADMIN_PASSWORD)]:
        response = client.post("/api/auth/login", json={"username": username, "password": password})
        assert response.status_code == 401
        assert response.json()["detail"] == "Identifiants incorrects."


def test_login_is_case_insensitive_on_username(client):
    login(client, "  ADMIN ", ADMIN_PASSWORD)


def test_protected_routes_require_a_valid_token(client):
    assert client.get("/api/tickets").status_code == 401
    bogus = {"Authorization": "Bearer not-a-token"}
    assert client.get("/api/tickets", headers=bogus).status_code == 401


def test_logout_revokes_the_token(client, admin):
    assert client.post("/api/auth/logout", headers=admin).status_code == 204
    assert client.get("/api/auth/me", headers=admin).status_code == 401


def test_expired_token_is_rejected(client, admin):
    session_factory = client.app.state.session_factory
    with session_factory() as db:
        db.execute(update(ApiToken).values(expires_at=utcnow() - timedelta(minutes=1)))
        db.commit()
    assert client.get("/api/auth/me", headers=admin).status_code == 401


def test_change_password_keeps_current_session_and_closes_others(client, member):
    other_session = login(client, "alice", MEMBER_PASSWORD)

    wrong = {"current_password": "nope", "new_password": "new-password"}
    assert client.put("/api/auth/me/password", json=wrong, headers=member).status_code == 400

    payload = {"current_password": MEMBER_PASSWORD, "new_password": "new-password"}
    assert client.put("/api/auth/me/password", json=payload, headers=member).status_code == 204

    assert client.get("/api/auth/me", headers=member).status_code == 200
    assert client.get("/api/auth/me", headers=other_session).status_code == 401
    login(client, "alice", "new-password")


def test_sso_is_disabled_by_default(client):
    assert client.get("/api/auth/sso").json() == {"enabled": False}
    assert client.get("/api/auth/sso/login", follow_redirects=False).status_code == 404
