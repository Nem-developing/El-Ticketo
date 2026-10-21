# Philosophie

El Ticketo est un outil de tickets **simple**. Ce n'est pas un ITSM et ça ne doit pas le devenir.

Tout le parcours tient en une phrase : **on ouvre un ticket, on le prend en charge, on commente,
on le ferme.** Une fonctionnalité qui allonge ce parcours n'a pas sa place ici.

## Principes

1. **Ouvrir un ticket prend quelques secondes.** Titre, catégorie, priorité, description
   facultative. Aucun autre champ, encore moins obligatoire.
2. **Rien à configurer avant de travailler.** Les statuts sont fixes (Nouveau → En cours →
   En attente → Fermé), il n'y a ni workflow à dessiner, ni formulaire à paramétrer.
3. **Deux rôles, pas plus.** Membre et administrateur. Pas de groupes, d'équipes ni de matrice de
   droits par projet.
4. **Des choix par défaut plutôt que des options.** Chaque réglage ajouté est un réglage que
   quelqu'un devra comprendre.
5. **Installer et mettre à jour en une commande.** Aucun service externe obligatoire.
6. **Moins, c'est mieux.** Un écran, un champ, une table ou une dépendance de plus doit se
   justifier ; en retirer un est toujours une bonne nouvelle.

## Avant d'ajouter quelque chose

- Est-ce utile à la plupart des utilisateurs, régulièrement ?
- Est-ce que ça ajoute un clic, un champ, un écran ou un réglage ? Peut-on l'éviter ?
- Peut-on y arriver en améliorant ce qui existe plutôt qu'en ajoutant ?
- Quelqu'un qui découvre l'outil comprend-il sans explication ?

**Dans le doute, on n'ajoute pas.** Retirer une fonctionnalité coûte toujours plus cher que de ne
pas l'avoir ajoutée.

## Ce qu'El Ticketo ne fera pas

- Workflows ou transitions de statut configurables, circuits d'approbation.
- SLA, escalades automatiques, astreintes.
- Champs, formulaires ou types de tickets personnalisés.
- Processus ITIL : gestion des changements, des problèmes, des actifs (CMDB).
- Permissions fines, groupes, équipes.
