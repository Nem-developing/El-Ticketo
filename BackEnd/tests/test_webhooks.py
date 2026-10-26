import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

import pytest

ALL_EVENTS = [
    "ticket.created",
    "ticket.updated",
    "ticket.deleted",
    "comment.created",
    "user.created",
]


@pytest.fixture
def receiver():
    """Petit serveur HTTP local qui garde les corps JSON reçus (`status` règle sa réponse)."""
    received: list[dict] = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            length = int(self.headers["Content-Length"])
            received.append(json.loads(self.rfile.read(length)))
            self.send_response(server.status)
            self.end_headers()

        def log_message(self, *args):
            pass

    server = HTTPServer(("127.0.0.1", 0), Handler)
    server.status = 200
    server.url = f"http://127.0.0.1:{server.server_port}/hook/secret"
    server.received = received
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield server
    server.shutdown()


def add_webhook(client, admin, url, events=ALL_EVENTS) -> dict:
    response = client.post("/api/webhooks", json={"url": url, "events": events}, headers=admin)
    assert response.status_code == 201, response.text
    return response.json()


def test_ticket_lifecycle_triggers_webhooks(client, admin, receiver, make_ticket):
    add_webhook(client, admin, receiver.url)

    ticket = make_ticket(title="Imprimante HS")
    url = f"/api/tickets/{ticket['id']}"
    client.patch(url, json={"status": "closed", "title": "Imprimante HS"}, headers=admin)
    client.post(f"{url}/comments", json={"body": "Réglé"}, headers=admin)
    client.delete(url, headers=admin)

    events = [payload["event"] for payload in receiver.received]
    assert events == ["ticket.created", "ticket.updated", "comment.created", "ticket.deleted"]
    created, updated, commented, deleted = receiver.received
    assert created["actor"] == "admin"
    assert created["ticket"]["title"] == "Imprimante HS"
    assert created["url"] == f"http://testserver/tickets/{ticket['id']}"
    assert created["text"] == (
        f"Ticket #{ticket['id']} créé par admin : Imprimante HS\n{created['url']}"
    )
    # Seuls les champs réellement modifiés sont annoncés.
    assert updated["changes"] == {"status": "closed"}
    assert commented["comment"]["body"] == "Réglé"
    assert deleted["ticket"]["id"] == ticket["id"]


def test_only_subscribed_events_are_sent(client, admin, receiver, make_ticket):
    add_webhook(client, admin, receiver.url, ["user.created"])
    make_ticket()
    client.post("/api/users", json={"username": "bob", "password": "bob-password"}, headers=admin)

    assert [payload["event"] for payload in receiver.received] == ["user.created"]
    assert receiver.received[0]["user"]["username"] == "bob"
    assert "password_hash" not in receiver.received[0]["user"]


def test_failures_are_logged_without_the_secret_path(client, admin, receiver, make_ticket):
    add_webhook(client, admin, receiver.url, ["ticket.created"])
    receiver.status = 500

    make_ticket()

    entry = client.get("/api/logs", params={"limit": 1}, headers=admin).json()[0]
    assert entry["level"] == "warning"
    host = receiver.url.split("/")[2]
    assert entry["message"] == (
        f"Webhook « ticket.created » vers {host} en échec : réponse HTTP 500"
    )


def test_test_button_reports_the_result(client, admin, receiver):
    webhook = add_webhook(client, admin, receiver.url)
    test_url = f"/api/webhooks/{webhook['id']}/test"

    assert client.post(test_url, headers=admin).status_code == 204
    assert receiver.received[0]["event"] == "ping"

    receiver.status = 404
    failed = client.post(test_url, headers=admin)
    assert failed.status_code == 502
    assert failed.json()["detail"] == "Échec de l'appel : réponse HTTP 404."


def test_webhooks_are_managed_by_admins(client, admin, member):
    payload = {"url": "https://exemple.fr/hook", "events": ["ticket.created"]}
    assert client.post("/api/webhooks", json=payload, headers=member).status_code == 403
    assert client.get("/api/webhooks", headers=member).status_code == 403

    for invalid in (
        {"url": "ftp://exemple.fr", "events": ["ticket.created"]},
        {"url": "https://exemple.fr", "events": []},
        {"url": "https://exemple.fr", "events": ["ticket.exploded"]},
    ):
        assert client.post("/api/webhooks", json=invalid, headers=admin).status_code == 422

    webhook = add_webhook(client, admin, payload["url"], payload["events"])
    changed = {"url": "https://exemple.fr/autre", "events": ["user.created", "ticket.created"]}
    updated = client.put(f"/api/webhooks/{webhook['id']}", json=changed, headers=admin).json()
    assert updated["events"] == ["user.created", "ticket.created"]
    assert client.delete(f"/api/webhooks/{webhook['id']}", headers=admin).status_code == 204
    assert client.get("/api/webhooks", headers=admin).json() == []
