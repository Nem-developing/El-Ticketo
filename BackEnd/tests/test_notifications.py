from app.notifications import mentioned


def notifications(client, headers) -> list[tuple[str, int, str, bool]]:
    response = client.get("/api/notifications", headers=headers)
    assert response.status_code == 200
    return [
        (item["kind"], item["ticket"]["id"], item["actor"]["username"], item["is_read"])
        for item in response.json()
    ]


def test_mentions_are_found_in_plain_text():
    text = "@Alice, vu avec @jean.dupont. Écrire à bob@exemple.fr ou (@chloe-b) ; @alice."
    assert mentioned(text) == {"alice", "jean.dupont", "chloe-b"}
    assert mentioned("rien à signaler @") == set()


def test_mentions_notify_once_until_read(client, admin, member, make_ticket):
    ticket = make_ticket(description="Vu avec @alice et @admin, pas @inconnu")
    assert notifications(client, member) == [("mention", ticket["id"], "admin", False)]
    # On ne se notifie pas soi-même.
    assert notifications(client, admin) == []

    url = f"/api/tickets/{ticket['id']}/comments"
    client.post(url, json={"body": "@alice tu peux regarder ?"}, headers=admin)
    assert len(notifications(client, member)) == 1

    client.post(f"/api/notifications/read?ticket_id={ticket['id']}", headers=member)
    assert notifications(client, member) == [("mention", ticket["id"], "admin", True)]
    client.post(url, json={"body": "Relance @alice"}, headers=admin)
    assert [item[3] for item in notifications(client, member)] == [False, True]


def test_editing_only_notifies_new_mentions(client, admin, member, make_ticket):
    ticket = make_ticket()
    url = f"/api/tickets/{ticket['id']}"
    client.patch(url, json={"description": "Pour @alice"}, headers=admin)
    client.post("/api/notifications/read", headers=member)

    client.patch(url, json={"description": "Pour @alice, merci"}, headers=admin)
    comment = client.post(f"{url}/comments", json={"body": "Corrigé"}, headers=admin).json()
    client.patch(f"{url}/comments/{comment['id']}", json={"body": "Corrigé"}, headers=admin)
    assert [item[3] for item in notifications(client, member)] == [True]

    client.patch(f"{url}/comments/{comment['id']}", json={"body": "@alice ?"}, headers=admin)
    assert [item[3] for item in notifications(client, member)] == [False, True]


def test_assignment_notifies_the_assignee_but_not_oneself(client, admin, member, make_ticket):
    ticket = make_ticket()
    alice = client.get("/api/auth/me", headers=member).json()
    me = client.get("/api/auth/me", headers=admin).json()
    url = f"/api/tickets/{ticket['id']}"

    client.patch(url, json={"assignee_id": alice["id"]}, headers=admin)
    assert notifications(client, member) == [("assignment", ticket["id"], "admin", False)]
    client.patch(url, json={"assignee_id": me["id"]}, headers=admin)
    assert notifications(client, admin) == []


def test_notifications_disappear_with_their_ticket(client, admin, member, make_ticket):
    ticket = make_ticket(description="@alice")
    other = make_ticket(description="@alice")
    client.post("/api/notifications/read", headers=member)
    assert [item[3] for item in notifications(client, member)] == [True, True]

    client.delete(f"/api/tickets/{ticket['id']}", headers=admin)
    assert notifications(client, member) == [("mention", other["id"], "admin", True)]
