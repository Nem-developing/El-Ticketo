"""Remplit une instance El Ticketo avec des données de démonstration.

Usage : python scripts/generate_data.py --url http://localhost:8080/api --password admin
"""

import argparse
import json
import random
import urllib.request

CATEGORIES = ["Support technique", "Demande d'information", "Problème de compte", "Bug", "Autre"]
SUBJECTS = ["Imprimante", "VPN", "Messagerie", "Poste de travail", "Wi-Fi", "Badge", "Logiciel"]
PROBLEMS = ["ne répond plus", "très lent", "accès refusé", "erreur au démarrage", "à installer"]
STATUSES = ["new", "in_progress", "waiting", "closed"]
PRIORITIES = ["low", "normal", "normal", "high"]


class Api:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.token: str | None = None

    def request(self, method: str, path: str, payload: dict | None = None) -> dict | list:
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        body = json.dumps(payload).encode() if payload is not None else None
        req = urllib.request.Request(self.base_url + path, body, headers, method=method)
        with urllib.request.urlopen(req) as response:
            return json.loads(response.read() or "null")

    def login(self, username: str, password: str) -> None:
        self.token = self.request(
            "POST", "/auth/login", {"username": username, "password": password}
        )["access_token"]


def create_tickets(api: Api, project_id: int, count: int) -> None:
    for index in range(1, count + 1):
        ticket = api.request(
            "POST",
            "/tickets",
            {
                "project_id": project_id,
                "title": f"{random.choice(SUBJECTS)} {random.choice(PROBLEMS)}",
                "description": "Ticket généré automatiquement pour la démonstration.",
                "category": random.choice(CATEGORIES),
                "priority": random.choice(PRIORITIES),
            },
        )
        status = random.choice(STATUSES)
        if status != "new":
            api.request("PATCH", f"/tickets/{ticket['id']}", {"status": status})
        print(f"  ticket #{ticket['id']} ({index}/{count}) → {status}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://localhost:8080/api")
    parser.add_argument("--username", default="admin")
    parser.add_argument("--password", default="admin")
    parser.add_argument("--projects", type=int, default=2, help="Projets supplémentaires à créer")
    parser.add_argument("--tickets", type=int, default=30, help="Tickets par projet")
    args = parser.parse_args()

    api = Api(args.url)
    api.login(args.username, args.password)

    existing = {project["name"] for project in api.request("GET", "/projects")}
    for number in range(1, args.projects + 1):
        name = f"Projet démo {number}"
        if name not in existing:
            api.request("POST", "/projects", {"name": name, "description": "Données de démo"})

    for project in api.request("GET", "/projects"):
        print(f"Projet « {project['name']} »")
        create_tickets(api, project["id"], args.tickets)


if __name__ == "__main__":
    main()
