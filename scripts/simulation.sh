#!/usr/bin/env bash
# Simulation d'activité : remplit une instance El Ticketo de projets, de personnes et de tickets
# réalistes (prises en charge, commentaires, mentions, blocs de code, pièces jointes, fermetures),
# puis, avec --vivre, la fait vivre en continu. Pour une démonstration, ou pour voir comment
# l'application se comporte avec un volume de données « de production ».
#
# Les identifiants administrateur sont lus dans le fichier .env à la racine du dépôt.
# Nécessite curl et jq.

set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
ENV_FILE=$ROOT/.env

usage() {
  cat <<'EOF'
Usage : scripts/simulation.sh [options]

Crée des projets, des personnes et des tickets qui vivent (prise en charge, commentaires,
mentions, blocs de code, pièces jointes, fermetures) sur l'instance décrite par .env.

Options :
  -t, --tickets N         tickets à créer (défaut : 200 ; 0 pour seulement faire vivre)
  -u, --utilisateurs N    personnes simulées, de 2 à 30 (défaut : 12)
  -v, --vivre             puis continuer à faire vivre l'instance, jusqu'à Ctrl + C
  -p, --pause S           secondes entre deux actions avec --vivre (défaut : 3)
  -y, --oui               ne pas demander de confirmation
  -h, --aide              afficher cette aide

L'API visée est http://localhost:$HTTP_PORT/api, ou ELTICKETO_URL si cette variable est définie
(ex. ELTICKETO_URL=https://tickets.exemple.fr/api). À chaque lancement, les personnes simulées
reçoivent un nouveau mot de passe aléatoire.

Les dates sont fixées par l'API : tout ce qui est créé l'est « maintenant ».
EOF
}

die() {
  echo "Erreur : $*" >&2
  exit 1
}

TICKETS=200
PEOPLE=12
LIVE=false
PAUSE=3
ASSUME_YES=false

while (($#)); do
  case $1 in
    -t | --tickets) TICKETS=${2-}; shift 2 || die "$1 attend un nombre" ;;
    -u | --utilisateurs) PEOPLE=${2-}; shift 2 || die "$1 attend un nombre" ;;
    -v | --vivre) LIVE=true; shift ;;
    -p | --pause) PAUSE=${2-}; shift 2 || die "$1 attend un nombre" ;;
    -y | --oui) ASSUME_YES=true; shift ;;
    -h | --aide | --help) usage; exit 0 ;;
    *) die "option inconnue : $1 (voir --aide)" ;;
  esac
done

[[ $TICKETS =~ ^[0-9]+$ ]] || die "--tickets attend un nombre"
if ! [[ $PEOPLE =~ ^[0-9]+$ ]] || ((PEOPLE < 2 || PEOPLE > 30)); then
  die "--utilisateurs : de 2 à 30"
fi
[[ $PAUSE =~ ^[0-9]+([.][0-9]+)?$ ]] || die "--pause attend un nombre de secondes"
command -v curl >/dev/null || die "curl est nécessaire"
command -v jq >/dev/null || die "jq est nécessaire (ex. apt install jq)"
[[ -f $ENV_FILE ]] || die "fichier $ENV_FILE introuvable"

# Lit KEY=valeur dans .env sans l'exécuter (guillemets éventuels retirés).
env_value() {
  sed -n "s/^$1=//p" "$ENV_FILE" | tail -n 1 | sed -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'$/\1/"
}

ADMIN_USERNAME=$(env_value ADMIN_USERNAME)
ADMIN_USERNAME=${ADMIN_USERNAME:-admin}
ADMIN_PASSWORD=$(env_value ADMIN_PASSWORD)
HTTP_PORT=$(env_value HTTP_PORT)
API=${ELTICKETO_URL:-http://localhost:${HTTP_PORT:-8080}/api}
API=${API%/}
[[ -n $ADMIN_PASSWORD ]] || die "ADMIN_PASSWORD est vide dans $ENV_FILE"

# --- Données ---------------------------------------------------------------------------------

NAMES=(
  camille.martin lucas.bernard lea.dubois hugo.thomas chloe.robert louis.richard manon.petit
  jules.durand ines.leroy adam.moreau sarah.simon nathan.laurent emma.lefebvre gabriel.michel
  jade.garcia arthur.david louise.bertrand raphael.roux alice.vincent paul.fournier zoe.morel
  tom.girard lina.andre noah.mercier rose.blanc ethan.guerin anna.boyer leo.garnier
  mila.chevalier sacha.francois
)

# nom|description|catégories (séparées par des virgules ; vide : celles par défaut)
PROJECTS=(
  "Informatique|Postes, comptes, réseau et logiciels.|"
  "Services généraux|Locaux, badges, mobilier et fournitures.|"
  "Site web|Le site public et l'intranet.|Bug,Contenu,Suggestion"
)

# Tickets de chaque projet (même ordre que PROJECTS) : titre|description|catégorie.
# Lus par indirection (TEMPLATES_$n).
# shellcheck disable=SC2034
TEMPLATES_0=(
  "L'imprimante du 2e étage ne répond plus|Elle apparaît « hors ligne » sur tous les postes depuis ce matin.|Problème"
  "Le VPN coupe toutes les 10 minutes|Depuis la mise à jour d'hier, la connexion tombe régulièrement en télétravail.|Problème"
  "Accès au dossier partagé Comptabilité|J'ai besoin d'un accès en lecture pour la clôture du mois.|Demande"
  "Installer Python sur mon poste|Pour les scripts de reporting, en version 3.12 si possible.|Demande"
  "Mot de passe expiré, impossible de me connecter|Le changement de mot de passe échoue avec « erreur inconnue ».|Problème"
  "Comment partager mon agenda ?|Je voudrais que mon équipe voie mes disponibilités.|Question"
  "Écran externe non détecté|Le second écran reste noir sur la station d'accueil.|Problème"
  "Nouveau poste pour une arrivée lundi|Une stagiaire arrive au service RH : il lui faut un portable et un compte.|Demande"
  "Messagerie très lente|Chaque message met plusieurs secondes à s'ouvrir.|Problème"
  "Deux licences Adobe pour la communication|Pour les deux personnes arrivées dans l'équipe.|Demande"
  "Le Wi-Fi invités ne marche plus en salle B|Les visiteurs n'obtiennent pas d'adresse IP.|Problème"
  "Proposer un gestionnaire de mots de passe|Beaucoup de collègues notent leurs mots de passe sur papier.|Suggestion"
  "Quelle procédure pour le télétravail ?|Faut-il un poste particulier pour se connecter depuis chez soi ?|Question"
  "Erreur 500 sur l'outil de notes de frais|Impossible de valider une note de frais.|Problème"
  "Sauvegarder mon poste avant réinstallation|Comment ne rien perdre de mes fichiers ?|Question"
)
# shellcheck disable=SC2034
TEMPLATES_1=(
  "Badge d'accès refusé au parking|Mon badge ne m'ouvre plus la barrière depuis lundi.|Problème"
  "Chauffage en panne au 3e étage|Il fait 16 °C dans l'open space.|Problème"
  "Réserver la grande salle pour le séminaire|Jeudi toute la journée, pour une quarantaine de personnes.|Demande"
  "Fauteuil de bureau cassé|Le vérin ne tient plus, le fauteuil descend tout seul.|Problème"
  "Commande de fournitures|Ramettes de papier, post-it et stylos pour le service achats.|Demande"
  "Fuite d'eau dans les sanitaires du rez-de-chaussée|Le robinet de gauche coule en continu.|Problème"
  "Où déposer les cartons à recycler ?|Il en reste beaucoup après le déménagement.|Question"
  "Des plantes dans l'open space|Ce serait plus agréable, et meilleur pour l'acoustique.|Suggestion"
  "Ampoule grillée en salle de réunion A|Le spot au-dessus de l'écran ne s'allume plus.|Problème"
  "Badge pour un prestataire|Il intervient trois semaines à partir de lundi.|Demande"
  "Climatisation trop forte côté sud|Il fait très froid près des fenêtres.|Problème"
  "Le bâtiment est-il ouvert le samedi ?|Peut-on venir travailler le samedi matin ?|Question"
)
# shellcheck disable=SC2034
TEMPLATES_2=(
  "Le formulaire de contact n'envoie rien|La confirmation s'affiche mais aucun message n'arrive.|Bug"
  "Mettre à jour les horaires d'accueil|Les horaires d'été sont à publier d'ici vendredi.|Contenu"
  "Images floues sur mobile|Les photos de la page d'accueil sont pixelisées sur téléphone.|Bug"
  "Ajouter une FAQ|Les mêmes questions reviennent sans cesse au standard.|Suggestion"
  "Lien cassé dans le pied de page|« Mentions légales » renvoie une erreur 404.|Bug"
  "Publier l'offre d'emploi de technicien|Le texte est validé par les RH, rubrique Recrutement.|Contenu"
  "Page d'accueil lente à charger|Plus de 5 secondes en 4G.|Bug"
  "Traduire la page Contact en anglais|Pour nos partenaires étrangers.|Contenu"
  "Un mode sombre pour l'intranet|Plusieurs collègues le demandent.|Suggestion"
  "La recherche de l'intranet ne trouve plus rien|Aucun résultat depuis la migration, même pour « congés ».|Bug"
)

# {demandeur}, {collegue} et {ticket} sont remplacés par @demandeur, @collègue et #n.
TECH_REPLIES=(
  "Je regarde ça dans la matinée."
  "{demandeur} pouvez-vous me dire depuis quand exactement ?"
  "C'est sans doute lié à {ticket}."
  "{collegue} tu as déjà eu ce cas ? Je sèche un peu."
  "Je relance le service, je vous tiens au courant."
  $'Voici ce que disent les journaux :\n```\nERROR connection refused (timeout after 30s)\nWARN  retrying in 5s…\nERROR connection refused (timeout after 30s)\n```\nJe creuse.'
  $'Pouvez-vous lancer ceci et me copier le résultat ?\n```powershell\nGet-NetIPConfiguration | Select-Object InterfaceAlias, IPv4Address\n```'
  $'Corrigé avec :\n```bash\nsudo systemctl restart cups && lpstat -p\n```'
  $'Le correctif côté configuration :\n```yaml\nsmtp:\n  host: smtp.exemple.fr\n  port: 587\n  starttls: true\n```'
  "J'attends le retour du fournisseur."
  "Commande passée, livraison prévue sous 48 h."
)
REQUESTER_REPLIES=(
  "Toujours le même problème ce matin."
  "Depuis lundi environ, sur tous les postes du service."
  "{collegue} a le même souci de son côté."
  "Je suis absent demain, vous pouvez voir avec {collegue}."
  "Merci pour la rapidité !"
  "Ça recommence, voir aussi {ticket}."
)
CLOSING_REPLIES=(
  "C'est réglé, je ferme. N'hésitez pas à rouvrir si besoin."
  "Fait. {demandeur} vous pouvez vérifier ?"
  "Résolu après redémarrage."
  "Livré et installé."
)

# --- API -------------------------------------------------------------------------------------

# api MÉTHODE CHEMIN TOKEN [JSON] : affiche la réponse ; échoue (avec le message de l'API) sur
# une erreur HTTP.
api() {
  local args=(-sS --fail-with-body -X "$1" -H "Authorization: Bearer $3")
  [[ -n ${4-} ]] && args+=(-H "Content-Type: application/json" --data-binary "$4")
  curl "${args[@]}" "$API$2"
}

login() {
  curl -sS --fail-with-body -H "Content-Type: application/json" \
    --data-binary "$(jq -nc --arg u "$1" --arg p "$2" '{username: $u, password: $p}')" \
    "$API/auth/login" | jq -r .access_token
}

pick() { # pick ÉLÉMENTS… : l'un d'eux, au hasard
  local items=("$@")
  printf '%s' "${items[RANDOM % ${#items[@]}]}"
}

chance() { # chance N : vrai N fois sur 100
  ((RANDOM % 100 < $1))
}

random_line() { # random_line < LIGNES : l'une d'elles au hasard (rien si l'entrée est vide)
  local lines=() line
  while IFS= read -r line; do lines+=("$line"); done
  if ((${#lines[@]})); then printf '%s' "${lines[RANDOM % ${#lines[@]}]}"; fi
}

log() {
  printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"
}

# Personnes simulées : identifiant, id et token aux mêmes indices.
USER_NAMES=()
USER_IDS=()
USER_TOKENS=()
# Tickets connus, pour les citer (#n).
TICKET_IDS=()

other_user() { # other_user INDEX : une autre personne que celle-ci
  local index
  while index=$((RANDOM % ${#USER_NAMES[@]})) && ((index == $1)); do :; done
  echo "$index"
}

user_index() { # user_index IDENTIFIANT : son indice, ou une personne au hasard
  local index
  for index in "${!USER_NAMES[@]}"; do
    [[ ${USER_NAMES[index]} == "$1" ]] && { echo "$index"; return; }
  done
  echo $((RANDOM % ${#USER_NAMES[@]}))
}

fill() { # fill TEXTE DEMANDEUR COLLÈGUE : remplace les {…} du texte
  local text=$1 ref="#1"
  ((${#TICKET_IDS[@]})) && ref="#${TICKET_IDS[RANDOM % ${#TICKET_IDS[@]}]}"
  text=${text//\{demandeur\}/@$2}
  text=${text//\{collegue\}/@$3}
  printf '%s' "${text//\{ticket\}/$ref}"
}

comment() { # comment TICKET INDEX_AUTEUR TEXTE
  api POST "/tickets/$1/comments" "${USER_TOKENS[$2]}" \
    "$(jq -nc --arg body "$3" '{body: $body}')" >/dev/null
}

update() { # update TICKET INDEX_AUTEUR JSON
  api PATCH "/tickets/$1" "${USER_TOKENS[$2]}" "$3" >/dev/null
}

attach_log() { # attach_log TICKET INDEX_AUTEUR : joint un journal d'erreurs
  local line
  for line in $(seq 1 40); do
    printf '2026-10-26 08:%02d:%02d ERROR service indisponible (code %d)\n' \
      $((line % 60)) $((RANDOM % 60)) $((500 + RANDOM % 4))
  done | curl -sS --fail-with-body -o /dev/null -H "Authorization: Bearer ${USER_TOKENS[$2]}" \
    -H "Content-Type: text/plain" --data-binary @- "$API/tickets/$1/attachments?name=journal.log"
}

# open_ticket INDEX_DEMANDEUR : ouvre un ticket dans un projet au hasard ; affiche son n°.
open_ticket() {
  local project=$((RANDOM % ${#PROJECT_IDS[@]})) templates template title description category
  templates="TEMPLATES_${project}[@]"
  template=$(pick "${!templates}")
  IFS='|' read -r title description category <<<"$template"
  local priority
  priority=$(pick low normal normal normal high)
  chance 30 && description=""
  api POST /tickets "${USER_TOKENS[$1]}" "$(jq -nc --argjson project "${PROJECT_IDS[project]}" \
    --arg title "$title" --arg description "$description" --arg category "$category" \
    --arg priority "$priority" '{project_id: $project, title: $title,
      description: $description, category: $category, priority: $priority}')" | jq -r .id
}

# Vie complète d'un ticket : prise en charge, échanges, attente, fermeture (ou rien du tout).
live_ticket() { # live_ticket TICKET INDEX_DEMANDEUR
  local ticket=$1 requester=$2 tech colleague exchanges
  chance 10 && attach_log "$ticket" "$requester"
  chance 20 && return # reste « Nouveau »

  tech=$(other_user "$requester")
  colleague=$(other_user "$tech")
  update "$ticket" "$tech" "{\"status\": \"in_progress\", \"assignee_id\": ${USER_IDS[tech]}}"

  exchanges=$((RANDOM % 4))
  while ((exchanges-- > 0)); do
    comment "$ticket" "$tech" "$(fill "$(pick "${TECH_REPLIES[@]}")" \
      "${USER_NAMES[requester]}" "${USER_NAMES[colleague]}")"
    chance 60 && comment "$ticket" "$requester" "$(fill "$(pick "${REQUESTER_REPLIES[@]}")" \
      "${USER_NAMES[requester]}" "${USER_NAMES[colleague]}")"
  done

  if chance 15; then
    update "$ticket" "$tech" '{"status": "waiting"}'
  elif chance 75; then
    comment "$ticket" "$tech" "$(fill "$(pick "${CLOSING_REPLIES[@]}")" \
      "${USER_NAMES[requester]}" "${USER_NAMES[colleague]}")"
    update "$ticket" "$tech" '{"status": "closed"}'
  fi
}

# Une action au hasard, comme dans une vraie journée.
live_action() {
  local roll=$((RANDOM % 100)) status line ticket creator assignee actor other
  if ((roll < 25)); then
    actor=$((RANDOM % ${#USER_NAMES[@]}))
    ticket=$(open_ticket "$actor")
    TICKET_IDS+=("$ticket")
    log "${USER_NAMES[actor]} ouvre le ticket #$ticket"
    return
  fi

  if ((roll < 40)); then status=new; elif ((roll < 90)); then status=in_progress
  elif ((roll < 95)); then status=waiting; else status=closed; fi
  line=$(api GET "/tickets?status=$status&limit=200" "${USER_TOKENS[0]}" |
    jq -r '.[] | "\(.id) \(.created_by.username) \(.assignee.username // "-")"' | random_line)
  [[ -n $line ]] || return 0
  read -r ticket creator assignee <<<"$line"
  creator=$(user_index "$creator")
  if [[ $assignee == - ]]; then actor=$(other_user "$creator"); else actor=$(user_index "$assignee"); fi
  other=$(other_user "$actor")

  case $status in
    new)
      update "$ticket" "$actor" "{\"status\": \"in_progress\", \"assignee_id\": ${USER_IDS[actor]}}"
      log "${USER_NAMES[actor]} prend en charge #$ticket"
      ;;
    in_progress)
      if chance 30; then
        comment "$ticket" "$actor" "$(fill "$(pick "${CLOSING_REPLIES[@]}")" \
          "${USER_NAMES[creator]}" "${USER_NAMES[other]}")"
        update "$ticket" "$actor" '{"status": "closed"}'
        log "${USER_NAMES[actor]} ferme #$ticket"
      elif chance 15; then
        update "$ticket" "$actor" "{\"assignee_id\": ${USER_IDS[other]}}"
        log "${USER_NAMES[actor]} assigne #$ticket à ${USER_NAMES[other]}"
      elif chance 50; then
        comment "$ticket" "$creator" "$(fill "$(pick "${REQUESTER_REPLIES[@]}")" \
          "${USER_NAMES[creator]}" "${USER_NAMES[other]}")"
        log "${USER_NAMES[creator]} commente #$ticket"
      else
        comment "$ticket" "$actor" "$(fill "$(pick "${TECH_REPLIES[@]}")" \
          "${USER_NAMES[creator]}" "${USER_NAMES[other]}")"
        log "${USER_NAMES[actor]} commente #$ticket"
      fi
      ;;
    waiting)
      comment "$ticket" "$actor" "Retour reçu, je reprends."
      update "$ticket" "$actor" '{"status": "in_progress"}'
      log "${USER_NAMES[actor]} reprend #$ticket"
      ;;
    closed)
      comment "$ticket" "$creator" "Le problème est revenu, je rouvre."
      update "$ticket" "$creator" '{"status": "in_progress"}'
      log "${USER_NAMES[creator]} rouvre #$ticket"
      ;;
  esac
}

# --- Déroulé ---------------------------------------------------------------------------------

curl -sSf -o /dev/null "$API/health" 2>/dev/null ||
  die "l'API ne répond pas sur $API (lancez « docker compose up -d », ou définissez ELTICKETO_URL)"

echo "Instance : $API"
echo "À créer  : ${#PROJECTS[@]} projets, $PEOPLE personnes, $TICKETS tickets$($LIVE && echo ", puis activité continue")"
if ! $ASSUME_YES; then
  [[ -t 0 ]] || die "confirmation impossible sans terminal : relancez avec --oui"
  echo "Ces données s'ajoutent à celles de l'instance ; les comptes ${NAMES[0]}, ${NAMES[1]}…"
  echo "qui existeraient déjà reçoivent un nouveau mot de passe."
  read -r -p "Continuer ? [o/N] " answer
  [[ $answer =~ ^[oOyY] ]] || exit 0
fi

ADMIN_TOKEN=$(login "$ADMIN_USERNAME" "$ADMIN_PASSWORD") ||
  die "connexion de « $ADMIN_USERNAME » refusée : vérifiez ADMIN_PASSWORD dans .env"

PROJECT_IDS=()
existing_projects=$(api GET /projects "$ADMIN_TOKEN")
for project in "${PROJECTS[@]}"; do
  IFS='|' read -r name description categories <<<"$project"
  id=$(jq -r --arg name "$name" '.[] | select(.name == $name) | .id' <<<"$existing_projects")
  if [[ -z $id ]]; then
    payload=$(jq -nc --arg name "$name" --arg description "$description" \
      --arg categories "$categories" '{name: $name, description: $description}
        + if $categories == "" then {} else {categories: ($categories | split(","))} end')
    id=$(api POST /projects "$ADMIN_TOKEN" "$payload" | jq -r .id)
    log "Projet « $name » créé"
  fi
  PROJECT_IDS+=("$id")
done

# Un mot de passe neuf à chaque lancement : rien de connu ne traîne, et on peut se connecter
# sous chaque identité.
PASSWORD=$(head -c 24 /dev/urandom | base64 | tr -d '/+=' | cut -c 1-20)
existing_users=$(api GET /users "$ADMIN_TOKEN")
for name in "${NAMES[@]:0:PEOPLE}"; do
  id=$(jq -r --arg name "$name" '.[] | select(.username == $name) | .id' <<<"$existing_users")
  if [[ -z $id ]]; then
    id=$(api POST /users "$ADMIN_TOKEN" \
      "$(jq -nc --arg u "$name" --arg p "$PASSWORD" '{username: $u, password: $p}')" | jq -r .id)
    log "Compte « $name » créé"
  elif ! api PATCH "/users/$id" "$ADMIN_TOKEN" \
    "$(jq -nc --arg p "$PASSWORD" '{password: $p, is_active: true}')" >/dev/null; then
    continue
  fi
  if token=$(login "$name" "$PASSWORD" 2>/dev/null); then
    USER_NAMES+=("$name")
    USER_IDS+=("$id")
    USER_TOKENS+=("$token")
  else
    echo "« $name » ne peut pas se connecter par mot de passe (compte SSO ?) : ignoré" >&2
  fi
done
((${#USER_NAMES[@]} >= 2)) || die "il faut au moins deux personnes pouvant se connecter"
echo "Les personnes simulées se connectent avec le mot de passe : $PASSWORD"

while read -r id; do TICKET_IDS+=("$id"); done < <(api GET "/tickets?limit=200" "$ADMIN_TOKEN" | jq -r '.[].id')

for ((count = 1; count <= TICKETS; count++)); do
  requester=$((RANDOM % ${#USER_NAMES[@]}))
  ticket=$(open_ticket "$requester")
  TICKET_IDS+=("$ticket")
  live_ticket "$ticket" "$requester"
  printf '\rTickets : %d / %d' "$count" "$TICKETS"
done
((TICKETS > 0)) && echo

if $LIVE; then
  trap 'echo; log "Arrêt de la simulation."; exit 0' INT TERM
  log "Activité continue, une action toutes les ${PAUSE} s (Ctrl + C pour arrêter)."
  while true; do
    live_action || log "Action échouée, on continue."
    sleep "$PAUSE"
  done
fi

echo "Terminé."
