#!/usr/bin/env bash
#
# Pose un tag de version vX.Y.Z — c'est ce qui déploie la production.
#
# Le tag n'est pas qu'une étiquette : `.github/workflows/release.yml` s'y
# déclenche, rejoue les vérifications, puis déploie sur Coolify après
# approbation. D'où le récapitulatif avant d'agir : ce script pousse.
#
# Il ne demande pas le type de version à l'aveugle, il le calcule depuis
# l'historique et présélectionne le résultat. Tu peux toujours choisir autre
# chose, mais tu ne peux plus rater un `feat!` qui aurait dû faire un majeur.
#
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

BOLD=$(printf '\033[1m'); DIM=$(printf '\033[2m'); RED=$(printf '\033[31m')
GREEN=$(printf '\033[32m'); YELLOW=$(printf '\033[33m'); CYAN=$(printf '\033[36m')
OFF=$(printf '\033[0m')

die() { echo "${RED}deploy:${OFF} $*" >&2; exit 1; }

# Le motif auquel `release.yml` se déclenche. Un tag qui ne lui correspond pas
# se crée très bien et ne déploie rien — d'où l'avertissement plus bas.
TAG_PATTERN='^v[0-9]+\.[0-9]+\.[0-9]+$'

# --- Sélection au clavier ----------------------------------------------------

# menu TITRE OPTION... — affiche un menu navigable et écrit l'indice retenu
# (à partir de 0) sur stdout. Tout l'affichage part sur /dev/tty pour que
# `choix=$(menu ...)` ne capture que le résultat.
#
# Le curseur de départ se règle par $MENU_START, ce qui permet de présélectionner
# le bump calculé : le geste le plus courant devient « Entrée ».
menu() {
  local title="$1"; shift
  local -a options=("$@")
  local n=${#options[@]}
  local cur="${MENU_START:-0}" key seq first=1

  printf '%s\n' "$title" >/dev/tty
  printf '%s\n' "${DIM}  ↑↓ pour choisir, Entrée pour valider, q pour annuler${OFF}" >/dev/tty

  while true; do
    # Après le premier passage, on remonte de n lignes pour réécrire le menu
    # en place plutôt que d'en empiler une copie à chaque frappe.
    if [ "$first" -eq 1 ]; then first=0; else printf '\033[%dA' "$n" >/dev/tty; fi

    local i
    for i in $(seq 0 $((n - 1))); do
      if [ "$i" -eq "$cur" ]; then
        printf '\033[2K  %s❯ %s%s\n' "$CYAN" "${options[$i]}" "$OFF" >/dev/tty
      else
        printf '\033[2K    %s\n' "${options[$i]}" >/dev/tty
      fi
    done

    IFS= read -rsn1 key </dev/tty || return 1
    case "$key" in
      $'\e')
        # Séquence de flèche : ESC [ A/B. Le délai évite de rester bloqué sur
        # un ESC seul.
        read -rsn2 -t 0.2 seq </dev/tty || seq=''
        case "$seq" in
          '[A') cur=$(((cur - 1 + n) % n)) ;;
          '[B') cur=$(((cur + 1) % n)) ;;
        esac
        ;;
      '')    break ;;
      k|K)   cur=$(((cur - 1 + n) % n)) ;;
      j|J)   cur=$(((cur + 1) % n)) ;;
      q|Q)   return 1 ;;
    esac
  done

  printf '%s' "$cur"
}

# pad TEXTE LARGEUR — complète à droite en comptant les CARACTÈRES et non les
# octets : `printf '%-30s'` décale les colonnes dès qu'un « … » ou un accent
# s'y trouve, chacun pesant plusieurs octets.
pad() {
  local text="$1" width="$2" n
  n=$((width - ${#text}))
  if [ "$n" -gt 0 ]; then
    printf '%s%*s' "$text" "$n" ''
  else
    printf '%s' "$text"
  fi
}

# --- Garde-fous --------------------------------------------------------------

[ -e /dev/tty ] || die "make deploy attend des réponses : lance-le depuis un terminal interactif."
[ -z "$(git status --porcelain)" ] || die "working tree sale — commite ou remise tes changements d'abord."

start_branch=$(git branch --show-current)
[ -n "$start_branch" ] || die "HEAD détachée — bascule sur une branche d'abord."

# --- 1. La branche à taguer --------------------------------------------------

# `main` en tête (c'est la seule que `release.yml` accepte de déployer), puis
# les autres de la plus récemment commitée à la plus ancienne.
mapfile -t branches < <(
  git branch --format='%(refname:short)' --sort=-committerdate \
    | awk '$0 == "main" { next } { print }' \
    | { git rev-parse --verify --quiet main >/dev/null && echo main; cat; }
)
[ "${#branches[@]}" -gt 0 ] || die "aucune branche locale."

# Un dépôt vivant accumule les branches, et une liste de trente entrées ne se
# parcourt plus : on n'en propose que les plus récentes, la saisie libre
# rattrapant les autres.
BRANCH_LIST_MAX=10
shown=("${branches[@]:0:BRANCH_LIST_MAX}")

echo
echo "${BOLD}Quelle branche veux-tu taguer ?${OFF}"
labels=()
for b in "${shown[@]}"; do
  subject=$(git log -1 --format='%s' "$b" 2>/dev/null | cut -c1-44)
  # Les noms longs sont tronqués plutôt que de décaler la colonne des sujets.
  short_b=$b
  [ "${#short_b}" -gt 30 ] && short_b="${short_b:0:29}…"
  labels+=("$(pad "$short_b" 30) ${DIM}${subject}${OFF}")
done
if [ "${#branches[@]}" -gt "$BRANCH_LIST_MAX" ]; then
  labels+=("$(pad "autre branche…" 30) ${DIM}$(( ${#branches[@]} - BRANCH_LIST_MAX )) de plus${OFF}")
fi

MENU_START=0 idx=$(menu "" "${labels[@]}") || die "annulé."
if [ "$idx" -ge "${#shown[@]}" ]; then
  printf 'Nom de la branche : '
  read -r branch < /dev/tty || die "annulé."
  git rev-parse --verify --quiet "refs/heads/$branch" >/dev/null \
    || die "la branche '$branch' n'existe pas en local."
else
  branch="${shown[$idx]}"
fi
echo "  → ${BOLD}${branch}${OFF}"

# Ce qui se déploie est le commit tagué tel que GitHub le connaît, pas l'état de
# cette machine. Une branche locale désynchronisée est donc un refus, et non un
# avertissement : dans un sens il manquerait au tag des commits déjà poussés,
# dans l'autre il embarquerait du code qui n'est jamais passé par la CI.
upstream=$(git rev-parse --abbrev-ref --symbolic-full-name "${branch}@{upstream}" 2>/dev/null || true)
if [ -n "$upstream" ]; then
  remote="${upstream%%/*}"
  echo "${DIM}Comparaison avec ${upstream}...${OFF}"
  git fetch --quiet "$remote" || die "impossible de contacter $remote."
  behind=$(git rev-list --count "${branch}..${upstream}")
  ahead=$(git rev-list --count "${upstream}..${branch}")
  if [ "$behind" -gt 0 ] && [ "$ahead" -gt 0 ]; then
    die "$branch et $upstream ont divergé ($ahead commit(s) d'un côté, $behind de l'autre) — rebase avant de taguer."
  elif [ "$behind" -gt 0 ]; then
    die "$branch est en retard de $behind commit(s) sur $upstream : le tag manquerait du code déjà publié. Fais un \`git pull\` d'abord."
  elif [ "$ahead" -gt 0 ]; then
    die "$branch a $ahead commit(s) que $upstream n'a pas : ils partiraient en production sans être passés par la CI. Pousse-les et fais-les vérifier d'abord."
  fi
  echo "${GREEN}✓${OFF} ${branch} est au même point que ${upstream}"
else
  echo "${DIM}${branch} n'a pas d'équivalent sur le distant : le push la créera.${OFF}"
fi

# On tague la branche choisie, donc on s'y place : le CHANGELOG et le commit de
# version doivent atterrir là où le tag pointe.
switched=0
if [ "$branch" != "$start_branch" ]; then
  switched=1
fi

# --- 2. Le point de départ ---------------------------------------------------

last_tag=$(git tag --list 'v[0-9]*' --sort=-v:refname | head -1)
if [ -z "$last_tag" ]; then
  base="0.0.0"
  range="$branch"
  echo
  echo "${DIM}Aucun tag existant, on part de 0.0.0${OFF}"
else
  base="${last_tag#v}"
  range="${last_tag}..${branch}"
  echo
  echo "Dernier tag : ${BOLD}${last_tag}${OFF} ${DIM}($(git log -1 --format='%ad' --date=short "$last_tag"))${OFF}"
fi

IFS='.' read -r cur_major cur_minor cur_patch <<<"$base"

# --- 3. Analyse des commits de la branche ------------------------------------

n_break=0; n_feat=0; n_fix=0; n_other=0
list_break=""; list_feat=""; list_fix=""; list_other=""

# Les champs sont séparés par \x1f, les commits par NUL (git log -z) : un corps
# de commit peut contenir des retours à la ligne, pas un NUL.
while IFS=$'\x1f' read -r -d '' sha subject body; do
  [ -n "$subject" ] || continue
  case "$subject" in
    'chore(release):'*) continue ;;
  esac

  short=${sha:0:7}
  type=$(printf '%s' "$subject" | sed -n 's/^\([a-z]\+\)\(([^)]*)\)\?!\?:.*/\1/p')
  breaking=0
  printf '%s' "$subject" | grep -qE '^[a-z]+(\([^)]*\))?!:' && breaking=1
  printf '%s' "$body" | grep -q 'BREAKING CHANGE' && breaking=1

  entry="  - ${subject} (${short})"$'\n'
  # Un commit breaking n'apparaît que dans sa propre section : le lister aussi
  # sous son type le ferait figurer deux fois à l'identique dans le CHANGELOG.
  if [ "$breaking" -eq 1 ]; then
    n_break=$((n_break + 1)); list_break+="$entry"
  else
    case "$type" in
      feat)     n_feat=$((n_feat + 1));   list_feat+="$entry" ;;
      fix|perf) n_fix=$((n_fix + 1));     list_fix+="$entry" ;;
      *)        n_other=$((n_other + 1)); list_other+="$entry" ;;
    esac
  fi
done < <(git log -z --format='%H%x1f%s%x1f%b' "$range")

total=$((n_break + n_feat + n_fix + n_other))
[ "$total" -gt 0 ] || die "aucun commit sur $branch depuis ${last_tag:-le début} — rien à publier."

if   [ "$n_break" -gt 0 ]; then computed="major"
elif [ "$n_feat"  -gt 0 ]; then computed="minor"
else                            computed="patch"
fi

pre_1_0_note=""
if [ "$cur_major" -eq 0 ] && [ "$computed" = "major" ]; then
  computed=minor
  pre_1_0_note="yes"
fi

next_version() {
  case "$1" in
    major) echo "$((cur_major + 1)).0.0" ;;
    minor) echo "${cur_major}.$((cur_minor + 1)).0" ;;
    patch) echo "${cur_major}.${cur_minor}.$((cur_patch + 1))" ;;
  esac
}

# L'affichage est borné, le CHANGELOG non : sur un premier tag l'historique
# entier défile, et la question à laquelle il faut répondre se retrouve hors
# écran. Les breaking changes s'affichent tous — ils décident du majeur, et il
# n'y en a jamais des dizaines.
show_section() {
  local color="$1" title="$2" count="$3" body="$4" limit="$5"
  [ "$count" -gt 0 ] || return 0
  echo "${color}${title} (${count})${OFF}"
  [ "$limit" -eq 0 ] && return 0
  printf '%s' "$body" | head -n "$limit"
  if [ "$count" -gt "$limit" ]; then
    echo "${DIM}  … et $((count - limit)) de plus${OFF}"
  fi
}

echo
echo "${BOLD}${total} commit(s) sur ${branch} depuis ${last_tag:-le début du dépôt}${OFF}"
show_section "$RED"    "Breaking changes" "$n_break" "$list_break" "$n_break"
show_section "$GREEN"  "Fonctionnalités"  "$n_feat"  "$list_feat"  5
show_section "$YELLOW" "Correctifs"       "$n_fix"   "$list_fix"   5
show_section "$DIM"    "Autres — sans effet sur la version" "$n_other" "$list_other" 0

if [ -n "$pre_1_0_note" ]; then
  echo
  echo "${YELLOW}Note :${OFF} il y a des breaking changes, mais la version majeure est encore 0."
  echo "En semver, une 0.x n'offre aucune garantie de stabilité : un breaking change n'y"
  echo "bump que le mineur. Choisis le majeur si tu estimes que le projet mérite sa 1.0.0."
fi

# --- 4. Le numéro de version -------------------------------------------------

echo
echo "${BOLD}Quelle version veux-tu poser ?${OFF}"

bumps=(major minor patch)
labels=()
start=0
for i in "${!bumps[@]}"; do
  b="${bumps[$i]}"
  case "$b" in
    major) name="majeur" ;;
    minor) name="mineur" ;;
    patch) name="patch" ;;
  esac
  suffix=""
  if [ "$b" = "$computed" ]; then
    suffix="${GREEN}conseillé d'après les commits${OFF}"
    start=$i
  fi
  labels+=("$(pad "$name" 8)$(pad "v$(next_version "$b")" 10) ${suffix}")
done
labels+=("personnalisée…")

MENU_START=$start idx=$(menu "" "${labels[@]}") || die "annulé."

if [ "$idx" -eq "${#bumps[@]}" ]; then
  echo "  → ${BOLD}personnalisée${OFF}"
  printf 'Tag à poser (ex: v1.2.3) : '
  read -r tag < /dev/tty || die "annulé."
  [ -n "$tag" ] || die "aucun tag saisi."
  # Un tag hors du motif se pose sans erreur et ne déclenche aucun workflow :
  # ni vérification, ni déploiement. Le dire maintenant, pas après le push.
  if ! printf '%s' "$tag" | grep -qE "$TAG_PATTERN"; then
    echo
    echo "${YELLOW}Attention :${OFF} « $tag » ne correspond pas au motif ${BOLD}vX.Y.Z${OFF} auquel"
    echo "release.yml se déclenche. Le tag sera créé, mais ${BOLD}rien ne sera déployé${OFF}."
  fi
  version="${tag#v}"
else
  bump="${bumps[$idx]}"
  version=$(next_version "$bump")
  tag="v${version}"
  echo "  → ${BOLD}${tag}${OFF}"
fi

git rev-parse "$tag" >/dev/null 2>&1 && die "le tag $tag existe déjà."

# --- 5. Avertissement de branche ---------------------------------------------

# `release.yml` refuse un tag dont le commit n'est pas un ancêtre de
# `origin/main` : la production ne déploie que du code passé par main.
if [ "$branch" != "main" ]; then
  echo
  echo "${YELLOW}Attention :${OFF} le tag portera sur ${BOLD}${branch}${OFF}, pas sur main."
  echo "release.yml vérifie que le commit tagué est sur main et refusera celui-ci :"
  echo "le tag sera bien créé, mais ${BOLD}la production ne sera pas déployée${OFF}."
fi

# --- 6. Récapitulatif --------------------------------------------------------

remote_name=$(git remote | head -1)

echo
echo "${BOLD}Ce qui va être exécuté :${OFF}"
echo
[ "$switched" -eq 1 ] && echo "  ${CYAN}git checkout ${branch}${OFF}"
if [ "${SKIP_CHECK:-0}" != "1" ]; then
  echo "  ${CYAN}make check${OFF}                      ${DIM}# refus de publier si c'est rouge${OFF}"
fi
echo "  ${DIM}# CHANGELOG.md : ajout de la section ${tag}${OFF}"
echo "  ${CYAN}git add CHANGELOG.md${OFF}"
echo "  ${CYAN}git commit -m \"chore(release): ${tag}\"${OFF}"
echo "  ${CYAN}git tag -a ${tag} -m \"${tag}\"${OFF}"
if [ -n "$remote_name" ]; then
  echo "  ${CYAN}git push --follow-tags ${remote_name} ${branch}${OFF}"
fi
[ "$switched" -eq 1 ] && echo "  ${CYAN}git checkout ${start_branch}${OFF}       ${DIM}# retour à ta branche${OFF}"
echo
if [ "$branch" = "main" ] && printf '%s' "$tag" | grep -qE "$TAG_PATTERN"; then
  echo "${DIM}Puis, côté GitHub : vérifications, release ${tag}, et déploiement de la${OFF}"
  echo "${DIM}production une fois approuvé dans l'environnement « production ».${OFF}"
  echo
fi

MENU_START=0 idx=$(menu "" "Annuler" "Exécuter") || die "annulé."
[ "$idx" -eq 1 ] || { echo "Annulé."; exit 0; }
echo

# --- 7. Exécution ------------------------------------------------------------

# À partir d'ici on modifie le dépôt : le retour à la branche de départ est
# posé en trappe pour survivre à un échec au milieu.
cleanup() {
  if [ "$switched" -eq 1 ] && [ "$(git branch --show-current)" != "$start_branch" ]; then
    git checkout --quiet "$start_branch" 2>/dev/null || true
  fi
}
trap cleanup EXIT

if [ "$switched" -eq 1 ]; then
  git checkout --quiet "$branch" || die "impossible de basculer sur $branch."
fi

if [ "${SKIP_CHECK:-0}" != "1" ]; then
  echo "${DIM}Vérification du dépôt (make check)...${OFF}"
  make check >/dev/null || die "make check échoue — corrige avant de publier une version."
  echo "${GREEN}✓${OFF} make check est vert"
fi

date_iso=$(date +%Y-%m-%d)
section="## ${tag} — ${date_iso}"$'\n\n'
[ "$n_break" -gt 0 ] && section+="### Breaking changes"$'\n\n'"${list_break}"$'\n'
[ "$n_feat"  -gt 0 ] && section+="### Fonctionnalités"$'\n\n'"${list_feat}"$'\n'
[ "$n_fix"   -gt 0 ] && section+="### Correctifs"$'\n\n'"${list_fix}"$'\n'
[ "$n_other" -gt 0 ] && section+="### Divers"$'\n\n'"${list_other}"$'\n'

if [ -f CHANGELOG.md ]; then
  existing=$(tail -n +2 CHANGELOG.md)
else
  existing=""
fi
{
  echo "# Changelog"
  echo
  printf '%s' "$section"
  printf '%s\n' "$existing"
} > CHANGELOG.md

echo "${GREEN}✓${OFF} CHANGELOG.md mis à jour"

git add CHANGELOG.md
git commit -q -m "chore(release): ${tag}"
git tag -a "$tag" -m "${tag}"
echo "${GREEN}✓${OFF} commit et tag ${BOLD}${tag}${OFF} créés sur ${BOLD}${branch}${OFF}"

if [ -z "$remote_name" ]; then
  echo "${DIM}Aucun remote configuré — rien à pousser.${OFF}"
  exit 0
fi

git push --follow-tags "$remote_name" "$branch"
echo "${GREEN}✓${OFF} poussé sur ${remote_name}/${branch}"

if [ "$branch" = "main" ] && printf '%s' "$tag" | grep -qE "$TAG_PATTERN"; then
  echo
  echo "Le déploiement attend une approbation dans l'environnement ${BOLD}production${OFF} :"
  echo "  ${DIM}gh run watch${OFF}"
fi
