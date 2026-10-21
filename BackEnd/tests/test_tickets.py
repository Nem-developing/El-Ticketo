def test_create_ticket_with_defaults(client, member, make_ticket):
    ticket = make_ticket(headers=member, title="  Écran noir  ", description="Depuis ce matin")
    assert ticket["title"] == "Écran noir"
    assert ticket["status"] == "new"
    assert ticket["priority"] == "normal"
    assert ticket["created_by"]["username"] == "alice"
    assert ticket["assignee"] is None
    assert ticket["closed_at"] is None
    assert ticket["created_at"].endswith("Z") or ticket["created_at"].endswith("+00:00")


def test_create_ticket_requires_title_category_and_existing_project(client, admin, project_id):
    assert (
        client.post("/api/tickets", json={"project_id": project_id}, headers=admin).status_code
        == 422
    )
    payload = {"project_id": 999, "title": "Test", "category": "Bug"}
    assert client.post("/api/tickets", json=payload, headers=admin).status_code == 404


def test_get_unknown_ticket_returns_404(client, admin):
    response = client.get("/api/tickets/999", headers=admin)
    assert response.status_code == 404
    assert response.json()["detail"] == "Ticket introuvable."


def test_list_tickets_with_filters(client, admin, make_ticket):
    printer = make_ticket(title="Imprimante bloquée", priority="high")
    make_ticket(title="Accès VPN", category="Réseau")
    client.patch(f"/api/tickets/{printer['id']}", json={"status": "in_progress"}, headers=admin)

    def titles(**params):
        response = client.get("/api/tickets", params=params, headers=admin)
        assert response.status_code == 200
        return [ticket["title"] for ticket in response.json()]

    assert titles(status="in_progress") == ["Imprimante bloquée"]
    assert set(titles(status=["new", "in_progress"])) == {
        "Imprimante bloquée",
        "Accès VPN",
        "Bienvenue sur El Ticketo !",
    }
    assert titles(q="vpn") == ["Accès VPN"]
    assert titles(q=f"#{printer['id']}") == titles(q=str(printer["id"])) == ["Imprimante bloquée"]
    assert titles(category="Réseau") == ["Accès VPN"]
    assert titles(q="99999999999999999999") == []
    assert titles(q="100%") == []
    assert titles(project_id=999) == []
    assert len(titles(limit=1)) == 1


def test_list_tickets_created_by_a_user(client, admin, member, make_ticket):
    mine = make_ticket(headers=member, title="Écran noir")
    make_ticket(title="Accès VPN")
    me = client.get("/api/auth/me", headers=member).json()

    response = client.get("/api/tickets", params={"created_by_id": me["id"]}, headers=admin)
    assert [ticket["id"] for ticket in response.json()] == [mine["id"]]


def test_closing_and_reopening_tracks_closed_at(client, admin, make_ticket):
    ticket = make_ticket()
    closed = client.patch(f"/api/tickets/{ticket['id']}", json={"status": "closed"}, headers=admin)
    assert closed.json()["closed_at"] is not None

    reopened = client.patch(
        f"/api/tickets/{ticket['id']}", json={"status": "waiting"}, headers=admin
    )
    assert reopened.json()["status"] == "waiting"
    assert reopened.json()["closed_at"] is None


def test_assign_and_unassign(client, admin, member, make_ticket):
    ticket = make_ticket()
    alice = client.get("/api/auth/me", headers=member).json()

    assigned = client.patch(
        f"/api/tickets/{ticket['id']}", json={"assignee_id": alice["id"]}, headers=member
    )
    assert assigned.json()["assignee"] == {"id": alice["id"], "username": "alice"}
    mine = client.get("/api/tickets", params={"assignee_id": alice["id"]}, headers=member).json()
    assert [t["id"] for t in mine] == [ticket["id"]]

    unassigned = client.patch(
        f"/api/tickets/{ticket['id']}", json={"assignee_id": None}, headers=admin
    )
    assert unassigned.json()["assignee"] is None

    unknown = client.patch(f"/api/tickets/{ticket['id']}", json={"assignee_id": 999}, headers=admin)
    assert unknown.status_code == 400


def test_move_ticket_to_another_project(client, admin, make_ticket):
    ticket = make_ticket()
    other = client.post("/api/projects", json={"name": "Réseau"}, headers=admin).json()

    moved = client.patch(
        f"/api/tickets/{ticket['id']}", json={"project_id": other["id"]}, headers=admin
    )
    assert moved.json()["project_id"] == other["id"]

    unknown = client.patch(f"/api/tickets/{ticket['id']}", json={"project_id": 999}, headers=admin)
    assert unknown.status_code == 404


def test_changes_are_recorded_in_history(client, admin, member, make_ticket):
    ticket = make_ticket()
    url = f"/api/tickets/{ticket['id']}"
    me = client.get("/api/auth/me", headers=member).json()
    client.patch(url, json={"status": "in_progress", "assignee_id": me["id"]}, headers=member)
    client.patch(url, json={"description": "Plus de détails", "priority": "normal"}, headers=admin)

    events = client.get(f"{url}/events", headers=admin).json()
    assert [(e["actor"]["username"], e["field"], e["value"]) for e in events] == [
        ("alice", "status", "in_progress"),
        ("alice", "assignee", "alice"),
        # La priorité inchangée (« normal ») n'est pas inscrite.
        ("admin", "description", None),
    ]


def test_partial_update_ignores_nulls_on_required_fields(client, admin, make_ticket):
    ticket = make_ticket()
    response = client.patch(
        f"/api/tickets/{ticket['id']}",
        json={"title": None, "priority": "low", "category": "Logiciel"},
        headers=admin,
    )
    assert response.status_code == 200
    body = response.json()
    assert (body["title"], body["priority"], body["category"]) == (
        ticket["title"],
        "low",
        "Logiciel",
    )


def test_only_admins_delete_tickets(client, admin, member, make_ticket):
    ticket = make_ticket()
    client.post(f"/api/tickets/{ticket['id']}/comments", json={"body": "Vu"}, headers=member)

    assert client.delete(f"/api/tickets/{ticket['id']}", headers=member).status_code == 403
    assert client.delete(f"/api/tickets/{ticket['id']}", headers=admin).status_code == 204
    assert client.get(f"/api/tickets/{ticket['id']}", headers=admin).status_code == 404


def test_comments_lifecycle(client, admin, member, make_ticket):
    ticket = make_ticket()
    base = f"/api/tickets/{ticket['id']}/comments"

    assert client.post(base, json={"body": "   "}, headers=member).status_code == 422
    created = client.post(base, json={"body": "Je regarde ça"}, headers=member)
    assert created.status_code == 201
    comment = created.json()
    assert comment["author"]["username"] == "alice"
    assert comment["updated_at"] is None

    url = f"{base}/{comment['id']}"
    assert client.patch(url, json={"body": "Piraté"}, headers=admin).status_code == 403
    edited = client.patch(url, json={"body": "C'est réglé"}, headers=member)
    assert edited.json()["body"] == "C'est réglé"
    assert edited.json()["updated_at"] is not None

    assert [c["body"] for c in client.get(base, headers=admin).json()] == ["C'est réglé"]
    assert client.get("/api/tickets/999/comments", headers=admin).status_code == 404

    assert client.delete(url, headers=admin).status_code == 204
    assert client.get(base, headers=admin).json() == []


def test_comment_must_belong_to_ticket(client, admin, make_ticket):
    first, second = make_ticket(), make_ticket()
    comment = client.post(
        f"/api/tickets/{first['id']}/comments", json={"body": "Hello"}, headers=admin
    ).json()
    response = client.delete(f"/api/tickets/{second['id']}/comments/{comment['id']}", headers=admin)
    assert response.status_code == 404


def test_long_texts_fit_in_the_database(client, admin, make_ticket):
    # 10 000 emoji (4 octets chacun en utf8mb4) : la limite maximale acceptée par l'API.
    longest = "🎫" * 10_000
    ticket = make_ticket(description=longest)
    assert (
        client.get(f"/api/tickets/{ticket['id']}", headers=admin).json()["description"] == longest
    )
    comment = client.post(
        f"/api/tickets/{ticket['id']}/comments", json={"body": longest}, headers=admin
    )
    assert comment.status_code == 201

    too_long = client.post(
        "/api/tickets",
        json={
            "project_id": ticket["project_id"],
            "title": "x",
            "category": "y",
            "description": longest + "!",
        },
        headers=admin,
    )
    assert too_long.status_code == 422
