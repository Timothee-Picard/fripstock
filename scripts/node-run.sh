#!/usr/bin/env sh
# Exécute une commande Node depuis un dossier du dépôt.
#
# Choisir entre Node local et conteneur ne peut PAS se décider sur la simple
# présence de `npm` : les node_modules du dépôt sont installés par les images
# Docker (Alpine / musl), et les binaires natifs qu'ils contiennent — le swc de
# Next, par exemple — sont illisibles par la glibc de l'hôte
# ("invalid ELF header"). Les dossiers de build montés (.next, dist) sont en
# plus créés par les conteneurs, donc en root.
#
# La règle est donc :
#   1. FRIPSTOCK_RUNNER=local → Node local. La CI le pose, parce qu'elle
#      installe ses node_modules nativement pour la plateforme du runner.
#   2. Docker disponible → conteneur du service pour apps/api et apps/web,
#      conteneur jetable sous l'UID de l'hôte pour l'outillage de la racine.
#   3. Sinon → Node local en dernier recours.
#
# Usage : scripts/node-run.sh <dossier-relatif> <commande...>
set -e

NODE_IMAGE=node:24-alpine

ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
DIR=${1:-.}
shift

run_local() {
  cd "$ROOT/$DIR"
  exec "$@"
}

# 1. Runner explicite.
if [ "${FRIPSTOCK_RUNNER:-}" = "local" ]; then
  run_local "$@"
fi

# 2. Chemin normal en développement : les conteneurs.
if docker compose version >/dev/null 2>&1; then
  case "$DIR" in
    apps/api)
      exec docker compose -f "$ROOT/docker-compose.yml" run --rm --no-deps -T api "$@"
      ;;
    apps/web)
      exec docker compose -f "$ROOT/docker-compose.yml" run --rm --no-deps -T web "$@"
      ;;
    *)
      # Outillage de la racine (prettier, commitlint) : il ne touche que des
      # fichiers versionnés, donc il tourne sous l'UID de l'hôte.
      exec docker run --rm -i \
        -e HOME=/tmp \
        -u "$(id -u):$(id -g)" \
        -v "$ROOT":/repo \
        -w "/repo/$DIR" \
        "$NODE_IMAGE" "$@"
      ;;
  esac
fi

# 3. Dernier recours.
if command -v npm >/dev/null 2>&1; then
  run_local "$@"
fi

echo "node-run.sh: ni Docker ni Node disponible pour exécuter '$*' dans $DIR" >&2
exit 1
