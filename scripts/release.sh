#!/usr/bin/env bash
#
# Pose un tag de version vX.Y.Z à partir des commits conventionnels.
#
# Le script ne demande pas le type de version à l'aveugle : il le calcule
# depuis l'historique et le propose par défaut. Tu peux toujours forcer autre
# chose, mais tu ne peux plus rater un `feat!` qui aurait dû faire un majeur.
#
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

BOLD=$(printf '\033[1m'); DIM=$(printf '\033[2m'); RED=$(printf '\033[31m')
GREEN=$(printf '\033[32m'); YELLOW=$(printf '\033[33m'); OFF=$(printf '\033[0m')

die() { echo "${RED}release:${OFF} $*" >&2; exit 1; }

# --- Garde-fous --------------------------------------------------------------

[ -z "$(git status --porcelain)" ] || die "working tree sale — commite ou remise tes changements d'abord."

branch=$(git branch --show-current)
[ "$branch" = "main" ] || die "release depuis '$branch' — bascule sur main d'abord."

if [ "${SKIP_CHECK:-0}" != "1" ]; then
  echo "${DIM}Vérification du dépôt (make check)...${OFF}"
  make check >/dev/null || die "make check échoue — corrige avant de publier une version."
  echo "${GREEN}✓${OFF} make check est vert"
fi

# --- Point de départ ---------------------------------------------------------

last_tag=$(git tag --list 'v[0-9]*' --sort=-v:refname | head -1)
if [ -z "$last_tag" ]; then
  base="0.0.0"
  range=""
  echo "${DIM}Aucun tag existant, on part de 0.0.0${OFF}"
else
  base="${last_tag#v}"
  range="${last_tag}..HEAD"
  echo "${DIM}Dernier tag : ${last_tag}${OFF}"
fi

IFS='.' read -r cur_major cur_minor cur_patch <<<"$base"

# --- Analyse des commits -----------------------------------------------------

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
      feat)     n_feat=$((n_feat + 1));  list_feat+="$entry" ;;
      fix|perf) n_fix=$((n_fix + 1));    list_fix+="$entry" ;;
      *)        n_other=$((n_other + 1)); list_other+="$entry" ;;
    esac
  fi
done < <(git log -z --format='%H%x1f%s%x1f%b' ${range:+"$range"})

total=$((n_break + n_feat + n_fix + n_other))
[ "$total" -gt 0 ] || die "aucun commit depuis ${last_tag:-le début} — rien à publier."

# --- Bump calculé ------------------------------------------------------------

if   [ "$n_break" -gt 0 ]; then computed=major
elif [ "$n_feat"  -gt 0 ]; then computed=minor
elif [ "$n_fix"   -gt 0 ]; then computed=patch
else                            computed=patch
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

# --- Récapitulatif -----------------------------------------------------------

echo
echo "${BOLD}${total} commit(s) depuis ${last_tag:-le début du dépôt}${OFF}"
[ "$n_break" -gt 0 ] && { echo "${RED}Breaking changes (${n_break})${OFF}"; printf '%s' "$list_break"; }
[ "$n_feat"  -gt 0 ] && { echo "${GREEN}Fonctionnalités (${n_feat})${OFF}"; printf '%s' "$list_feat"; }
[ "$n_fix"   -gt 0 ] && { echo "${YELLOW}Correctifs (${n_fix})${OFF}"; printf '%s' "$list_fix"; }
[ "$n_other" -gt 0 ] && { echo "${DIM}Autres (${n_other}) — sans effet sur la version${OFF}"; printf '%s' "$list_other"; }

if [ -n "$pre_1_0_note" ]; then
  echo
  echo "${YELLOW}Note :${OFF} il y a des breaking changes, mais la version majeure est encore 0."
  echo "En semver, une 0.x n'offre aucune garantie de stabilité : un breaking change"
  echo "n'y bump que le mineur. Choisis ${BOLD}M${OFF} si tu estimes que le projet mérite sa 1.0.0."
fi

suggested=$(next_version "$computed")
echo
echo "Bump calculé : ${BOLD}${computed}${OFF} → ${BOLD}v${suggested}${OFF}"
echo "  ${DIM}[Entrée] accepter   M majeur ($(next_version major))   m mineur ($(next_version minor))   p patch ($(next_version patch))   q quitter${OFF}"
# On lit sur /dev/tty et non sur stdin : `make check` plus haut consomme
# l'entrée standard, et `read` tomberait sur EOF — le script mourrait alors sur
# une erreur opaque au lieu de poser la question.
[ -e /dev/tty ] || die "make release attend une réponse : lance-le depuis un terminal interactif."
printf 'Ton choix : '
read -r answer < /dev/tty || answer=q
echo

case "${answer:-}" in
  '')  bump=$computed ;;
  M)   bump=major ;;
  m)   bump=minor ;;
  p)   bump=patch ;;
  q|Q) echo "Annulé."; exit 0 ;;
  *)   die "réponse '$answer' non reconnue (attendu : Entrée, M, m, p ou q)." ;;
esac

version=$(next_version "$bump")
tag="v${version}"
git rev-parse "$tag" >/dev/null 2>&1 && die "le tag $tag existe déjà."

# --- CHANGELOG ---------------------------------------------------------------

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

echo
echo "${GREEN}✓${OFF} CHANGELOG.md mis à jour"

# --- Commit, tag, push -------------------------------------------------------

git add CHANGELOG.md
git commit -q -m "chore(release): ${tag}"
git tag -a "$tag" -m "${tag}"
echo "${GREEN}✓${OFF} commit et tag ${BOLD}${tag}${OFF} créés en local"

if ! git remote | grep -q .; then
  echo "${DIM}Aucun remote configuré — rien à pousser.${OFF}"
  exit 0
fi

echo
printf "Pousser %s et le tag sur %s ? [o/N] " "$branch" "$(git remote | head -1)"
read -r push_answer < /dev/tty || push_answer=n
case "$push_answer" in
  o|O|y|Y)
    git push --follow-tags
    echo "${GREEN}✓${OFF} poussé"
    ;;
  *)
    echo "Non poussé. Quand tu voudras : ${BOLD}git push --follow-tags${OFF}"
    ;;
esac
