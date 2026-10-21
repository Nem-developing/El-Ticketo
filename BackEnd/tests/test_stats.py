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
