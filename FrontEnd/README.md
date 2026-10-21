# El Ticketo — Application web

React 19 + TypeScript, construit avec Vite. Les données passent par
[TanStack Query](https://tanstack.com/query) (cache, rafraîchissement automatique) et le routage
par React Router.

## Commandes

```bash
npm install
npm run dev        # serveur de développement (http://localhost:5173)
npm run build      # vérification des types + build de production dans dist/
npm run lint       # ESLint (aucun avertissement toléré)
npm run typecheck  # TypeScript seul
npm test           # tests Vitest + Testing Library
```

En développement, Vite relaie `/api` vers `http://localhost:8080` (variable `API_URL` pour viser
une autre adresse).

## Organisation de `src/`

| Dossier       | Rôle                                                                   |
| ------------- | ---------------------------------------------------------------------- |
| `api/`        | Client HTTP, types de l'API et hooks de requêtes (`queries.ts`)        |
| `auth/`       | Session (connexion / déconnexion) et routes protégées                  |
| `context/`    | Projet courant, thème clair / sombre, notifications                    |
| `components/` | Mise en page, composants d'interface, tickets, graphiques              |
| `pages/`      | Une page par route (`admin/` pour les pages réservées aux admins)      |
| `lib/`        | Libellés, formatage des dates, petits utilitaires                      |
| `styles/`     | SCSS : jetons de design (`_tokens.scss`), base, composants, pages      |
| `test/`       | Configuration et utilitaires des tests (`*.test.ts(x)` à côté du code) |

Toutes les couleurs passent par les variables CSS de `styles/_tokens.scss`, déclinées en thème
clair et sombre.

## Image Docker

`Dockerfile` construit l'application puis la sert avec nginx : repli sur `index.html` pour les
routes de l'application, cache long des fichiers versionnés, compression gzip et en-têtes de
sécurité (`nginx-security-headers.conf`, dont une CSP qui n'autorise que les scripts du site —
d'où `public/theme-init.js` plutôt qu'un script inline). La police Rubik est embarquée
(`@fontsource-variable/rubik`) : aucune ressource externe n'est chargée. À construire depuis la
racine du dépôt :

```bash
docker build -f FrontEnd/Dockerfile -t elticketo/app .
```
