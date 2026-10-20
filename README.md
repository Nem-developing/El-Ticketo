# El Ticketo

Gestion de tickets **simple** : on ouvre un ticket en quelques secondes, on le prend en charge,
on commente, on le ferme. Pas de workflow à configurer, pas de formulaire à rallonge.

- **Tickets** : titre, description, catégorie, priorité, statut (Nouveau → En cours → En attente → Fermé), assigné.
- **Commentaires** sur chaque ticket.
- **Tableau de bord** : compteurs par statut, activité quotidienne, répartition par catégorie.
- **Projets** pour séparer plusieurs services ou équipes.
- **Deux rôles** : membre (gère les tickets) et administrateur (gère aussi les comptes et les projets).

## Démarrer avec Docker

```bash
cp .env.example .env   # puis renseignez DB_PASSWORD et ADMIN_PASSWORD
docker compose up -d --build
```

L'application est disponible sur <http://localhost:8080> (API et documentation Swagger sur
<http://localhost:8080/api/docs>). Connectez-vous avec le compte `admin` et le mot de passe
choisi dans `.env`.

Outils optionnels : `docker compose --profile tools up -d` ajoute phpMyAdmin sur
<http://localhost:8080/phpmyadmin/>.

Pour tout arrêter et repartir d'une base vide :

```bash
docker compose down -v
```

> **En production :** la pile est servie en HTTP. Placez-la derrière un proxy TLS (ou ajoutez un
> point d'entrée HTTPS à Traefik) et ne publiez pas phpMyAdmin.
>
> **Mise à jour depuis la v3 :** le schéma de la base a changé. L'API refuse de démarrer sur une
> ancienne base : repartez d'une base vide (`docker compose down -v`).

## Architecture

| Dossier                  | Contenu                                                                        |
| ------------------------ | ------------------------------------------------------------------------------ |
| [`BackEnd/`](BackEnd/)   | API REST — Python, FastAPI, SQLAlchemy, MariaDB ([README](BackEnd/README.md))   |
| [`FrontEnd/`](FrontEnd/) | Application web — React, TypeScript, Vite ([README](FrontEnd/README.md))       |

En production, Traefik route `/api` vers l'API et le reste vers l'application (servie par nginx) :
le front et l'API partagent le même domaine, sans configuration CORS.

## Développer en local

```bash
# API (SQLite, aucune base à installer)
cd BackEnd
python3 -m venv .venv && .venv/bin/pip install -r requirements-dev.txt
DATABASE_URL="sqlite:///./dev.db" .venv/bin/uvicorn app.main:create_app --factory --reload --port 8080

# Application (dans un autre terminal) — les appels /api sont relayés vers le port 8080
cd FrontEnd
npm install
npm run dev
```

Avant de pousser : `pytest` + `ruff` côté API, `npm run lint`, `npm test` et `npm run build`
côté application. La CI GitHub Actions rejoue tout cela (API testée sur SQLite et MariaDB) et
construit les deux images Docker.

## Licence

[GPL-3.0](LICENSE)
