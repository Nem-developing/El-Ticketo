# El Ticketo

Gestion de tickets **simple** : on ouvre un ticket en quelques secondes, on le prend en charge,
on commente, on le ferme. Pas de workflow à configurer, pas de formulaire à rallonge.

Ce n'est pas un ITSM et ça ne le deviendra pas : voir la [philosophie du projet](PHILOSOPHIE.md).

- **Tickets** : titre, description, catégorie, priorité, statut (Nouveau → En cours → En attente → Fermé), assigné.
- **Pièces jointes** : collez une capture d'écran (Ctrl + V) ou glissez un fichier, 1 Go au plus,
  sur le ticket ou dans un commentaire.
- **Commentaires** et **historique** automatique des modifications (statut, assignation, projet…).
  `@` propose les personnes à mentionner, `#` les tickets à citer (`#42` devient un lien).
- **Notifications** : une cloche signale quand quelqu'un vous mentionne (`@identifiant`) ou vous
  assigne un ticket ; ouvrir le ticket les marque comme lues.
- **Mes tickets** (qui me sont assignés), **Mes demandes** (que j'ai ouverts), recherche par mot ou
  par n°, export CSV.
- **Tableau de bord** : compteurs par statut, activité quotidienne, répartition par catégorie.
- **Vue d'ensemble** (administrateurs) : charge par projet et par personne, délai de résolution.
- **Journal** (administrateurs) : connexions, comptes, projets, suppressions et erreurs, conservé
  un an.
- **Webhooks** (administrateurs) : une adresse appelée à la création, la modification ou la
  suppression d'un ticket, à chaque commentaire ou nouveau compte (Slack, Mattermost, n8n…).
- **Projets** pour séparer plusieurs services ou équipes, chacun avec ses catégories.
- **Deux rôles** : membre (gère les tickets) et administrateur (gère aussi les comptes et les projets).
- **Connexion unique (SSO)** facultative, avec tout fournisseur OpenID Connect.

## Démarrer avec Docker

```bash
cp .env.example .env   # puis renseignez DB_PASSWORD et ADMIN_PASSWORD
docker compose up -d
```

L'application est disponible sur <http://localhost:8080> (API et documentation Swagger sur
<http://localhost:8080/api/docs>). Connectez-vous avec le compte `admin` et le mot de passe
choisi dans `.env`.

Outils optionnels : `docker compose --profile tools up -d` ajoute phpMyAdmin sur
<http://localhost:8080/phpmyadmin/>.

Pour passer à la dernière version (la base est migrée automatiquement) :

```bash
docker compose pull && docker compose up -d
```

Pour rester sur une version précise, renseignez `ELTICKETO_VERSION` dans `.env` (ex. `3.4`).

Pour tout arrêter et repartir d'une base vide :

```bash
docker compose down -v
```

> **En production :** la pile est servie en HTTP. Placez-la derrière un proxy TLS (ou ajoutez un
> point d'entrée HTTPS à Traefik) et ne publiez pas phpMyAdmin. Les pièces jointes sont stockées
> dans la base : la sauvegarder suffit.
>
> **Mise à jour depuis une version 2.x :** le schéma de la base a changé. L'API refuse de démarrer
> sur une ancienne base : repartez d'une base vide (`docker compose down -v`).

## Connexion unique (SSO)

El Ticketo accepte tout fournisseur OpenID Connect : Microsoft Entra ID, Google Workspace,
Keycloak, Authentik, Okta… Tout se règle dans **Administration > SSO** : l'adresse de retour à
déclarer chez le fournisseur y est affichée, puis on saisit l'émetteur, l'identifiant et le secret
du client. « Tester la connexion » fait un aller-retour complet chez le fournisseur et indique quel
compte serait utilisé, sans ouvrir de session ; une fois le test réussi, cochez « Proposer
« Se connecter avec le SSO » » (la connexion par mot de passe reste possible).

> Derrière un proxy TLS, renseignez `PUBLIC_URL` (ex. `https://tickets.exemple.fr`) dans `.env`
> si l'adresse de retour affichée commence par `http://`.

À sa première connexion, une personne :

- retrouve le compte qui porte son identifiant (la partie avant le @ de son adresse) : ce compte
  passe au SSO et son mot de passe ne sert plus ; le désactiver chez le fournisseur suffit à
  couper l'accès, à l'expiration de la session en cours ;
- sinon, obtient un compte membre, qu'un administrateur promeut au besoin.

Le compte administrateur initial (`ADMIN_USERNAME`) n'est jamais rattaché : il reste un accès de
secours par mot de passe. Qui peut se connecter se règle chez le fournisseur (utilisateurs
affectés à l'application).

## Lien « Signaler un problème »

Un lien vers `/tickets/new` peut pré-remplir le formulaire, depuis l'intranet ou un outil de
supervision. Tous les paramètres sont facultatifs (`project` est l'identifiant du projet) :

```text
https://tickets.exemple.fr/tickets/new?title=Imprimante%20HS&category=Matériel&priority=high&project=2
```

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

## Publier une version

Publiez une release GitHub (tag `3.4`, par exemple) : Cloud Build (`cloudbuild.yaml`) pousse les
images `elticketo/api` et `elticketo/app` sous ce tag et sous `latest`. Le numéro de version n'est
écrit nulle part dans le code.

## Licence

[GPL-3.0](LICENSE)
