# El Ticketo — API

API REST en **FastAPI** + **SQLAlchemy 2** (MariaDB en production, SQLite pour les tests).
La documentation interactive (Swagger) est servie sur `/api/docs`.

## Démarrer en local

```bash
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
DATABASE_URL="sqlite:///./dev.db" .venv/bin/uvicorn app.main:create_app --factory --reload --port 8080
```

Au démarrage, l'API attend la base, applique les migrations puis, si la base est vide, crée un
compte administrateur (`ADMIN_USERNAME` / `ADMIN_PASSWORD`), un projet et un ticket de bienvenue.

## Tests et qualité

```bash
.venv/bin/pytest                 # SQLite en mémoire
TEST_DATABASE_URL="mysql+pymysql://user:pass@127.0.0.1:3306/elticketo_test" .venv/bin/pytest
.venv/bin/ruff check . && .venv/bin/ruff format --check .
```

> ⚠️ Avec `TEST_DATABASE_URL`, les tables de la base ciblée sont supprimées à chaque test :
> utilisez une base dédiée.

La CI (`.github/workflows/ci.yml`) exécute ces vérifications sur SQLite **et** MariaDB.

## Faire évoluer le schéma

Les migrations [Alembic](https://alembic.sqlalchemy.org/) sont dans `app/migrations/versions/`
et s'appliquent automatiquement au démarrage. Après avoir modifié `app/models.py` :

```bash
DATABASE_URL="sqlite:///./migration.db" .venv/bin/alembic upgrade head
DATABASE_URL="sqlite:///./migration.db" .venv/bin/alembic revision --autogenerate -m "description"
```

Relisez le fichier généré. Le test `test_migrations_match_the_models` échoue tant que modèles et
migrations divergent.

## Dépendances

`requirements.in` liste les dépendances directes ; `requirements.txt` fige toutes les versions
(builds reproductibles). Pour mettre à jour :

```bash
uv pip compile requirements.in -o requirements.txt --python-version 3.12
uv pip compile requirements-dev.in -o requirements-dev.txt --python-version 3.12
```

## Configuration

| Variable                | Défaut      | Rôle                                                           |
| ----------------------- | ----------- | -------------------------------------------------------------- |
| `DATABASE_URL`          | —           | URL SQLAlchemy complète (prioritaire sur les variables `DB_*`) |
| `DB_HOSTNAME`           | `localhost` | Hôte MariaDB                                                   |
| `DB_PORT`               | `3306`      | Port MariaDB                                                   |
| `DB_NAME`               | `elticketo` | Base de données                                                |
| `DB_USER`               | `elticketo` | Utilisateur                                                    |
| `DB_PASSWORD`           | *(vide)*    | Mot de passe                                                   |
| `ADMIN_USERNAME`        | `admin`     | Compte administrateur créé au premier démarrage                |
| `ADMIN_PASSWORD`        | `admin`     | Son mot de passe (obligatoire via docker compose)              |
| `TOKEN_TTL_HOURS`       | `168`       | Durée de validité d'une session                                |
| `LOGIN_MAX_ATTEMPTS`    | `5`         | Tentatives de connexion autorisées par fenêtre…                |
| `LOGIN_LOCKOUT_MINUTES` | `15`        | …de cette durée, par couple adresse IP / identifiant           |
| `CORS_ORIGINS`          | *(vide)*    | Origines autorisées, séparées par des virgules                 |
| `FORWARDED_ALLOW_IPS`   | réseaux privés (image Docker) | Proxys autorisés à transmettre l'IP du client |
| `ELTICKETO_VERSION`     | `dev`       | Version affichée, fixée dans l'image par `cloudbuild.yaml`     |

Une valeur invalide (nombre mal formé, identifiant admin incorrect…) empêche le démarrage avec un
message explicite.

## Modèle

- **Utilisateurs** : `admin` (gère comptes et projets) ou membre (tout le reste).
- **Projets** : un nom et une description.
- **Tickets** : titre, description, catégorie (texte libre), priorité (`low` / `normal` / `high`),
  statut (`new` → `in_progress` → `waiting` → `closed`), assigné optionnel.
- **Commentaires** : modifiables par leur auteur, supprimables par l'auteur ou un admin.
- **Pièces jointes** : 1 Go au plus, stockées en base par morceaux de 4 Mo ; supprimables par leur
  auteur ou un admin.
- **Historique** : chaque modification d'un ticket (statut, assignation, projet…) est inscrite.

## Routes principales

| Méthode      | Route                                                               | Accès                            |
| ------------ | ------------------------------------------------------------------- | -------------------------------- |
| GET          | `/api/health`                                                       | public                           |
| POST         | `/api/auth/login` · `/api/auth/logout`                              | public · connecté                |
| GET · PUT    | `/api/auth/me` · `/api/auth/me/password`                            | connecté                         |
| GET          | `/api/users`                                                        | connecté                         |
| POST · PATCH | `/api/users` · `/api/users/{id}`                                    | admin                            |
| GET          | `/api/projects`                                                     | connecté                         |
| POST · PATCH | `/api/projects` · `/api/projects/{id}`                              | admin                            |
| GET · POST   | `/api/tickets` (filtres `project_id`, `status`, `assignee_id`, `created_by_id`, `category`, `q`) | connecté |
| GET · PATCH  | `/api/tickets/{id}` (le PATCH accepte aussi `project_id`)           | connecté                         |
| DELETE       | `/api/tickets/{id}`                                                 | admin                            |
| GET · POST   | `/api/tickets/{id}/comments`                                        | connecté                         |
| PATCH/DELETE | `/api/tickets/{id}/comments/{comment_id}`                           | auteur (ou admin pour supprimer) |
| GET          | `/api/tickets/{id}/events` (historique)                             | connecté                         |
| GET · POST   | `/api/tickets/{id}/attachments` (POST : fichier brut, `?name=`)     | connecté                         |
| GET          | `/api/attachments/{id}/file` (lien signé fourni par la liste)       | lien signé                       |
| DELETE       | `/api/attachments/{id}`                                             | auteur ou admin                  |
| GET          | `/api/stats?project_id=&days=30&tz=Europe/Paris`                    | connecté                         |
| GET          | `/api/stats/overview` (charge par projet et par personne)           | admin                            |

## Données de démonstration

```bash
python scripts/generate_data.py --url http://localhost:8080/api --password <mot de passe admin>
```
