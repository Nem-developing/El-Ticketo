# El Ticketo — consignes pour Claude

@PHILOSOPHIE.md

Cette philosophie prime : face à une demande qui alourdirait l'outil, proposer la variante la plus
simple (ou ne rien ajouter) et le dire.

## Repères

- `BackEnd/` : FastAPI, SQLAlchemy 2, Alembic, MariaDB (SQLite pour les tests).
- `FrontEnd/` : React 19, TypeScript, Vite, TanStack Query, SCSS (couleurs dans `_tokens.scss`).
- Tout est en français : interface, messages de l'API, commentaires, documentation.
- Code sobre : peu de commentaires, courts, qui expliquent le pourquoi plutôt que le quoi.
- Toutes les données restent dans la base, pièces jointes comprises : aucun fichier dans un volume,
  il n'y a que la base à sauvegarder.
- Modifier `BackEnd/app/models.py` impose une migration Alembic (voir `BackEnd/README.md`).

## Vérifications

```bash
cd BackEnd && .venv/bin/pytest && .venv/bin/ruff check . && .venv/bin/ruff format --check .
cd FrontEnd && npm run format:check && npm run lint && npm test && npm run build
```

## Versions

La version est le tag git de la release (ex. `3.4`) ; elle n'est écrite nulle part ailleurs.
Publier une release GitHub lance `cloudbuild.yaml`, qui pousse les images sous ce tag et sous
`latest`.
