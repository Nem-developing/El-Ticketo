from tests.conftest import MEMBER_PASSWORD


def _alice_id(client, headers) -> int:
    users = client.get("/api/users", headers=headers).json()
    return next(user["id"] for user in users if user["username"] == "alice")


def test_admin_creates_user_with_normalized_username(client, admin):
    payload = {"username": " Bob.Martin ", "password": "bob-password"}
    response = client.post("/api/users", json=payload, headers=admin)
    assert response.status_code == 201
    body = response.json()
    assert body["username"] == "bob.martin"
    assert body["is_admin"] is False
    assert "password" not in body and "password_hash" not in body


def test_username_must_be_unique(client, admin, member):
    payload = {"username": "alice", "password": "another-password"}
    assert client.post("/api/users", json=payload, headers=admin).status_code == 409


def test_user_payload_is_validated(client, admin):
    too_short = {"username": "carol", "password": "short"}
    assert client.post("/api/users", json=too_short, headers=admin).status_code == 422
    bad_name = {"username": "carol smith", "password": "long-enough"}
    assert client.post("/api/users", json=bad_name, headers=admin).status_code == 422


def test_members_cannot_manage_users(client, member):
    payload = {"username": "mallory", "password": "mallory-password"}
    assert client.post("/api/users", json=payload, headers=member).status_code == 403
    assert client.get("/api/users", headers=member).status_code == 200


def test_deactivating_a_user_closes_their_sessions(client, admin, member):
    alice_id = _alice_id(client, admin)
    response = client.patch(f"/api/users/{alice_id}", json={"is_active": False}, headers=admin)
    assert response.json()["is_active"] is False
    assert client.get("/api/auth/me", headers=member).status_code == 401
    login = client.post("/api/auth/login", json={"username": "alice", "password": MEMBER_PASSWORD})
    assert login.status_code == 401


def test_admin_can_reset_a_password(client, admin, member):
    alice_id = _alice_id(client, admin)
    payload = {"password": "reset-password"}
    assert client.patch(f"/api/users/{alice_id}", json=payload, headers=admin).status_code == 200
    assert client.get("/api/auth/me", headers=member).status_code == 401
    credentials = {"username": "alice", "password": "reset-password"}
    assert client.post("/api/auth/login", json=credentials).status_code == 200


def test_admin_cannot_lock_themselves_out(client, admin):
    admin_id = client.get("/api/auth/me", headers=admin).json()["id"]
    for payload in ({"is_admin": False}, {"is_active": False}):
        assert (
            client.patch(f"/api/users/{admin_id}", json=payload, headers=admin).status_code == 400
        )


def test_projects_are_managed_by_admins(client, admin, member):
    payload = {"name": "Support interne", "description": "Demandes des collègues"}
    assert client.post("/api/projects", json=payload, headers=member).status_code == 403
    created = client.post("/api/projects", json=payload, headers=admin)
    assert created.status_code == 201
    assert client.post("/api/projects", json=payload, headers=admin).status_code == 409

    project_id = created.json()["id"]
    renamed = client.patch(f"/api/projects/{project_id}", json={"name": "Support"}, headers=admin)
    assert renamed.json()["name"] == "Support"
    taken = client.patch(
        f"/api/projects/{project_id}", json={"name": "Projet initial"}, headers=admin
    )
    assert taken.status_code == 409
    assert taken.json()["detail"] == "Un projet porte déjà ce nom."
    assert len(client.get("/api/projects", headers=member).json()) == 2


def test_projects_have_their_own_categories(client, admin, member, project_id):
    # Le projet créé au premier démarrage, comme un nouveau projet, reprend la liste par défaut.
    initial = client.get("/api/projects", headers=member).json()[0]
    assert initial["categories"] == ["Problème", "Demande", "Question", "Suggestion"]
    created = client.post("/api/projects", json={"name": "Réseau"}, headers=admin).json()
    assert created["categories"] == initial["categories"]

    url = f"/api/projects/{project_id}"
    payload = {"categories": [" Wifi ", "VPN", "Wifi", "Câblage, prises"]}
    updated = client.patch(url, json=payload, headers=admin).json()
    assert updated["categories"] == ["Wifi", "VPN", "Câblage, prises"]
    assert client.patch(url, json={"categories": []}, headers=admin).json()["categories"] == []

    for invalid in (["Deux\nlignes"], [""], ["x" * 51]):
        response = client.patch(url, json={"categories": invalid}, headers=admin)
        assert response.status_code == 422
    assert client.patch(url, json=payload, headers=member).status_code == 403

    logs = [entry["message"] for entry in client.get("/api/logs", headers=admin).json()]
    assert logs[0] == "Catégories du projet « Projet initial » modifiées"
