from datetime import UTC, datetime, time, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import update

from app.models import Ticket


def test_stats_counts_categories_and_timeline(client, admin, project_id, make_ticket):
    make_ticket(category="Réseau")
    make_ticket(category="Réseau")
    closed = make_ticket(category="Matériel")
    client.patch(f"/api/tickets/{closed['id']}", json={"status": "closed"}, headers=admin)

    response = client.get("/api/stats", params={"project_id": project_id, "days": 7}, headers=admin)
    assert response.status_code == 200
    stats = response.json()

    # Le ticket de bienvenue (catégorie "Autre") est compté avec les trois nouveaux.
    assert stats["counts"] == {"new": 3, "in_progress": 0, "waiting": 0, "closed": 1, "total": 4}
    assert stats["by_category"][0] == {"category": "Réseau", "count": 2}
    assert {c["category"] for c in stats["by_category"]} == {"Réseau", "Matériel", "Autre"}

    timeline = stats["timeline"]
    assert len(timeline) == 7
    today = timeline[-1]
    assert today["date"] == datetime.now(UTC).date().isoformat()
    assert (today["created"], today["closed"]) == (4, 1)
    assert all(point["created"] == 0 for point in timeline[:-1])


def test_stats_are_scoped_to_a_project(client, admin):
    response = client.get("/api/stats", params={"project_id": 999}, headers=admin)
    assert response.json()["counts"]["total"] == 0
    assert response.json()["by_category"] == []


def test_stats_validate_days(client, admin):
    assert client.get("/api/stats", params={"days": 0}, headers=admin).status_code == 422
    assert client.get("/api/stats", params={"days": 400}, headers=admin).status_code == 422


def test_timeline_days_follow_the_requested_timezone(client, admin, make_ticket):
    project = client.post("/api/projects", json={"name": "Fuseaux"}, headers=admin).json()
    ticket = make_ticket(project_id=project["id"])

    paris = ZoneInfo("Europe/Paris")
    paris_midnight = datetime.combine(datetime.now(paris).date(), time.min, tzinfo=paris)
    # 00:10 à Paris tombe la veille en UTC (UTC+1 ou UTC+2).
    created_at = paris_midnight + timedelta(minutes=10)
    with client.app.state.session_factory() as db:
        db.execute(update(Ticket).where(Ticket.id == ticket["id"]).values(created_at=created_at))
        db.commit()

    def days_with_tickets(tz: str) -> list[str]:
        params = {"project_id": project["id"], "days": 3, "tz": tz}
        timeline = client.get("/api/stats", params=params, headers=admin).json()["timeline"]
        return [point["date"] for point in timeline if point["created"]]

    assert days_with_tickets("Europe/Paris") == [created_at.date().isoformat()]
    assert days_with_tickets("UTC") == [created_at.astimezone(UTC).date().isoformat()]
    assert created_at.date() != created_at.astimezone(UTC).date()


def test_stats_reject_an_unknown_timezone(client, admin):
    for tz in ("Mars/Olympus", "../etc/passwd", ""):
        response = client.get("/api/stats", params={"tz": tz}, headers=admin)
        assert response.status_code == 422, tz


def test_overview_shows_workload_per_project_and_person(client, admin, member, make_ticket):
    alice = client.get("/api/auth/me", headers=member).json()
    assigned = make_ticket()
    client.patch(f"/api/tickets/{assigned['id']}", json={"assignee_id": alice["id"]}, headers=admin)
    closed = make_ticket()
    client.patch(f"/api/tickets/{closed['id']}", json={"status": "closed"}, headers=admin)

    assert client.get("/api/stats/overview", headers=member).status_code == 403
    overview = client.get("/api/stats/overview", headers=admin).json()

    # Ouverts : le ticket de bienvenue et celui assigné à alice.
    [project] = overview["projects"]
    assert project["open"] == 2
    assert project["unassigned"] == 1
    assert project["stale"] == 0
    assert project["closed_recently"] == 1
    assert project["resolution_hours"] < 1
    assert [(p["user"]["username"], p["open"]) for p in overview["people"]] == [
        ("alice", 1),
        ("admin", 0),
    ]
    assert [t["title"] for t in overview["oldest_open"]][0] == "Bienvenue sur El Ticketo !"


def test_overview_keeps_deactivated_people_who_still_have_tickets(
    client, admin, member, make_ticket
):
    alice = client.get("/api/auth/me", headers=member).json()
    ticket = make_ticket()
    client.patch(f"/api/tickets/{ticket['id']}", json={"assignee_id": alice["id"]}, headers=admin)
    client.patch(f"/api/users/{alice['id']}", json={"is_active": False}, headers=admin)

    def people():
        overview = client.get("/api/stats/overview", headers=admin).json()
        return [(p["user"]["username"], p["user"]["is_active"]) for p in overview["people"]]

    assert ("alice", False) in people()
    client.patch(f"/api/tickets/{ticket['id']}", json={"assignee_id": None}, headers=admin)
    assert "alice" not in [username for username, _ in people()]
